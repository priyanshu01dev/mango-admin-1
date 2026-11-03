import { Business, BusinessDoc, Membership, User } from '../models/core';
import { Expense, Invoice, InvoiceDoc, TradeDocument } from '../models/billing';
import { Broadcast, Setting } from '../models/platform';
import { channels, emailLayout, escapeHtml, sendEmail, sendSms, sendWhatsAppTemplate } from './notify';
import { config } from '../config';
import { daysBetween, r2 } from '../../../shared/gst';
import { todayIST } from '../lib/dates';

/** Background jobs run by the scheduler in index.ts (and callable from tests / admin). */

// ---------------- broadcasts ----------------

async function segmentBusinessIds(segment: string) {
  const today = todayIST();
  const filter: Record<string, unknown> = { status: { $ne: 'SUSPENDED' } };
  if (segment === 'FREE') filter.planId = 'free';
  if (segment === 'PAID') filter.planId = { $ne: 'free' };
  if (segment === 'TRIAL_EXPIRING') Object.assign(filter, { trialPlanId: { $ne: null }, trialEndsOn: { $gte: today, $lte: todayIST(3) } });
  if (segment === 'PAST_DUE') filter.status = 'PAST_DUE';
  if (segment === 'INACTIVE_14D') filter.$or = [{ lastActiveAt: { $lt: new Date(Date.now() - 14 * 86400000) } }, { lastActiveAt: null }];
  if (segment === 'EINVOICE_ELIGIBLE') filter.aatoBand = { $ne: 'UPTO_5CR' };
  return (await Business.find(filter, { _id: 1 }).lean()).map(b => b._id);
}

/**
 * Delivers QUEUED broadcasts and SCHEDULED ones that are due, to business owners and admins, on every
 * requested channel that is configured. Push needs the mobile app's device tokens (Phase 4).
 */
export async function deliverBroadcasts() {
  const due = await Broadcast.find({ $or: [{ status: 'QUEUED' }, { status: 'SCHEDULED', scheduledAt: { $lte: new Date() } }] }).limit(20);
  const out: { id: string; delivered: number; skipped: string[] }[] = [];
  for (const b of due) {
    const usable = b.channels.filter(c => (c === 'EMAIL' && channels.email()) || (c === 'WHATSAPP' && channels.whatsapp()) || (c === 'SMS' && channels.sms() && !!config.MSG91_BROADCAST_TEMPLATE_ID));
    const skipped = b.channels.filter(c => !usable.includes(c));
    if (!usable.length) {
      await Broadcast.updateOne({ _id: b._id }, { status: 'QUEUED', lastError: `No configured channel among ${b.channels.join(', ')}` });
      out.push({ id: String(b._id), delivered: 0, skipped });
      continue;
    }
    const ids = await segmentBusinessIds(b.segment);
    const members = await Membership.find({ businessId: { $in: ids }, role: { $in: ['OWNER', 'ADMIN'] }, status: 'ACTIVE' }, { userId: 1 }).lean();
    const users = await User.find({ _id: { $in: [...new Set(members.map(m => String(m.userId)))] }, status: 'ACTIVE' }).lean();
    let delivered = 0;
    for (const u of users) {
      let ok = false;
      for (const c of usable) {
        try {
          if (c === 'EMAIL' && u.email) await sendEmail({ to: u.email, subject: b.title, html: emailLayout(b.title, `<p>${escapeHtml(b.message).replace(/\n/g, '<br/>')}</p>`) });
          else if (c === 'WHATSAPP' && u.phone) await sendWhatsAppTemplate(u.phone, config.WHATSAPP_BROADCAST_TEMPLATE, [b.title, b.message], b.language === 'Hindi' ? 'hi' : 'en');
          else if (c === 'SMS' && u.phone) await sendSms(u.phone, config.MSG91_BROADCAST_TEMPLATE_ID, { title: b.title, message: b.message.slice(0, 100) });
          else continue;
          ok = true;
        } catch {
          /* one failed recipient must not stop the broadcast */
        }
      }
      if (ok) delivered++;
    }
    await Broadcast.updateOne({ _id: b._id }, { status: 'SENT', sentAt: new Date(), recipients: users.length, delivered, lastError: skipped.length ? `Not sent on ${skipped.join(', ')} (not configured)` : '' });
    out.push({ id: String(b._id), delivered, skipped });
  }
  return out;
}

// ---------------- automatic payment reminders ----------------

/**
 * For businesses that turned on auto reminders: on each configured day after the due date, one reminder
 * per invoice per day-offset, on the first configured channel that works.
 */
export async function sendDueReminders() {
  const today = todayIST();
  const { sendReminder } = await import('../routes/integrations');
  const businesses = await Business.find({ 'invoiceSettings.autoReminders.enabled': true, status: 'ACTIVE' }).lean<BusinessDoc[]>();
  let sent = 0;
  for (const biz of businesses) {
    const ar = (biz.invoiceSettings as { autoReminders?: { days?: number[]; channels?: ('WHATSAPP' | 'SMS' | 'EMAIL')[] } }).autoReminders ?? {};
    const days = ar.days?.length ? ar.days : [1, 7, 15];
    const order = ar.channels?.length ? ar.channels : (['WHATSAPP', 'SMS', 'EMAIL'] as const);
    const invoices = await Invoice.find({ businessId: biz._id, status: { $in: ['UNPAID', 'PARTIALLY_PAID'] }, balanceDue: { $gt: 0 }, dueDate: { $lt: today } }).lean<InvoiceDoc[]>();
    for (const inv of invoices) {
      const late = daysBetween(inv.dueDate!, today);
      if (!days.includes(late)) continue;
      const already = ((inv as { remindersSent?: { at: Date }[] }).remindersSent ?? []).some(r => new Date(r.at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));
      if (already) continue;
      for (const ch of order) {
        try {
          await sendReminder(biz, inv, ch);
          sent++;
          break;
        } catch {
          /* try the next channel */
        }
      }
    }
  }
  return { sent };
}

// ---------------- monthly CA report ----------------

export async function buildCaReport(biz: BusinessDoc, periodArg?: string) {
  const now = new Date(Date.now() + 5.5 * 3600000);
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const period = periodArg ?? prev.toISOString().slice(0, 7);
  const [y, m] = period.split('-').map(Number);
  const from = `${period}-01`;
  const to = `${period}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  const range = { $gte: from, $lte: to };
  const [invoices, docs, expenses] = await Promise.all([
    Invoice.find({ businessId: biz._id, status: { $ne: 'CANCELLED' }, date: range }).lean(),
    TradeDocument.find({ businessId: biz._id, status: { $ne: 'CANCELLED' }, date: range, docType: { $in: ['PURCHASE_BILL', 'CREDIT_NOTE', 'DEBIT_NOTE'] } }).lean(),
    Expense.find({ businessId: biz._id, date: range }).lean()
  ]);
  const sum = <T>(rows: T[], f: (r: T) => number) => r2(rows.reduce((a, r) => a + (f(r) || 0), 0));
  const sales = sum(invoices, i => i.taxableTotal ?? 0);
  const outGst = sum(invoices, i => i.totalGst ?? 0) - sum(docs.filter(d => d.docType === 'CREDIT_NOTE'), d => d.totalGst ?? 0);
  const itc = sum(docs.filter(d => d.docType === 'PURCHASE_BILL' && d.itcEligible), d => d.totalGst ?? 0) - sum(docs.filter(d => d.docType === 'DEBIT_NOTE'), d => d.totalGst ?? 0) + sum(expenses.filter(e => e.itcEligible), e => e.gstAmount ?? 0);
  const purchases = sum(docs.filter(d => d.docType === 'PURCHASE_BILL'), d => d.taxableTotal ?? 0);
  const exp = sum(expenses, e => e.amount);
  const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const row = (k: string, v: string) => `<tr><td style="padding:4px 8px;color:#57534e">${k}</td><td style="padding:4px 8px;text-align:right;font-family:monospace">${v}</td></tr>`;
  const html = emailLayout(`${biz.name} · ${period} summary`, `<p>Monthly figures for your client <b>${escapeHtml(biz.name)}</b> (GSTIN ${escapeHtml(biz.gstin || '—')}).</p>
<table style="border-collapse:collapse;width:100%">${row('Invoices', String(invoices.length))}${row('Sales (taxable)', money(sales))}${row('Output GST (net of credit notes)', money(outGst))}${row('Purchases (taxable)', money(purchases))}${row('Eligible ITC', money(itc))}${row('Net GST payable (before set-off rules)', money(r2(outGst - itc)))}${row('Expenses', money(exp))}</table>
<p style="font-size:12px;color:#78716c">The attached CSV lists every invoice. Download GSTR-1 JSON from Reports in the app for filing.</p>`);
  const csv = ['Invoice,Date,Party,GSTIN,Place of supply,Taxable,CGST,SGST,IGST,Total']
    .concat(invoices.map(i => [i.number, i.date, `"${i.partyName.replace(/"/g, '""')}"`, i.partyGstin ?? '', i.placeOfSupply, i.taxableTotal, i.cgstTotal, i.sgstTotal, i.igstTotal, i.grandTotal].join(',')))
    .join('\n');
  return { period, subject: `GST summary ${period} · ${biz.name}`, html, attachments: [{ filename: `invoices-${period}.csv`, content: csv, contentType: 'text/csv' }] };
}

export async function emailCaReports() {
  const businesses = await Business.find({ autoEmailCa: true, caEmail: { $gt: '' }, status: 'ACTIVE' }).lean<BusinessDoc[]>();
  let sent = 0;
  for (const biz of businesses) {
    try {
      const r = await buildCaReport(biz);
      await sendEmail({ to: (biz as { caEmail: string }).caEmail, subject: r.subject, html: r.html, attachments: r.attachments });
      sent++;
    } catch {
      /* continue with the next business */
    }
  }
  return { sent };
}

/**
 * Runs `job` at most once per key (e.g. per day) across all server instances, using an atomic upsert.
 * Returns false if another instance already ran it.
 */
export async function onceFor(key: string, job: () => Promise<unknown>) {
  const res = await Setting.updateOne({ _id: `job:${key}` }, { $setOnInsert: { value: { startedAt: new Date() } } }, { upsert: true });
  if (!res.upsertedCount) return false;
  await job();
  return true;
}
