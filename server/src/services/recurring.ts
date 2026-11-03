import type { Request } from 'express';
import { RecurringInvoice } from '../models/phase2';
import { Business, BusinessDoc, User, UserDoc } from '../models/core';
import { createInvoice, addDays } from './invoices';
import { todayIST } from '../lib/dates';

export function nextDate(from: string, frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY') {
  if (frequency === 'WEEKLY') return addDays(from, 7);
  const [y, m, d] = from.split('-').map(Number);
  const add = frequency === 'MONTHLY' ? 1 : frequency === 'QUARTERLY' ? 3 : 12;
  const target = new Date(Date.UTC(y, m - 1 + add, 1));
  // keep the day of month, clamped to the month length (31 Jan → 28/29 Feb)
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * Raises every due recurring invoice. Each profile is claimed atomically (nextRunOn is moved forward
 * before the invoice is created) so two server instances never bill the same period twice.
 */
export async function runDueRecurring(businessId?: string) {
  const today = todayIST();
  const results: { profile: string; invoice?: string; error?: string }[] = [];
  for (;;) {
    const filter: Record<string, unknown> = { active: true, nextRunOn: { $lte: today } };
    if (businessId) filter.businessId = businessId;
    const due = await RecurringInvoice.findOne(filter).sort({ nextRunOn: 1 }).lean();
    if (!due) break;
    const next = nextDate(due.nextRunOn, due.frequency as 'MONTHLY');
    const claimed = await RecurringInvoice.findOneAndUpdate(
      { _id: due._id, nextRunOn: due.nextRunOn },
      { nextRunOn: next, ...(due.endsOn && next > due.endsOn ? { active: false } : {}) },
      { new: true }
    );
    if (!claimed) continue; // another worker took it

    const business = await Business.findById(due.businessId).lean<BusinessDoc>();
    const user = await User.findById(due.createdBy).lean<UserDoc>();
    if (!business || !user || business.status === 'SUSPENDED') {
      await RecurringInvoice.updateOne({ _id: due._id }, { active: false, lastError: 'Business suspended or user removed' });
      results.push({ profile: due.name, error: 'skipped' });
      continue;
    }
    const req = { business, user, ip: 'scheduler', role: 'OWNER' } as unknown as Request;
    try {
      const inv = await createInvoice(req, {
        partyId: String(due.partyId),
        date: due.nextRunOn,
        dueDate: addDays(due.nextRunOn, due.dueDays ?? 15),
        items: due.items.map(i => ({
          productId: i.productId ? String(i.productId) : undefined,
          name: i.name ?? undefined,
          hsnCode: i.hsnCode ?? undefined,
          unit: i.unit ?? undefined,
          quantity: i.quantity ?? 1,
          price: i.price ?? undefined,
          discountPercent: i.discountPercent ?? 0,
          gstRate: i.gstRate ?? undefined,
          priceIncludesTax: !!i.priceIncludesTax
        })),
        notes: due.notes || `Recurring: ${due.name}`,
        sourceDoc: `RECURRING:${due._id}`
      });
      await RecurringInvoice.updateOne({ _id: due._id }, { $inc: { runs: 1 }, lastInvoiceNumber: inv.number, lastRunAt: new Date(), lastError: '' });
      results.push({ profile: due.name, invoice: inv.number });
    } catch (e) {
      // give the period back so it is retried once the problem (stock, plan limit…) is fixed
      await RecurringInvoice.updateOne({ _id: due._id }, { nextRunOn: due.nextRunOn, active: false, lastError: (e as Error).message });
      results.push({ profile: due.name, error: (e as Error).message });
    }
  }
  return results;
}
