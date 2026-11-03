import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { PLATFORM_TOTALS } from '../../data/adminData';
import { Broadcast, BroadcastChannel, BroadcastSegment } from '../../types/admin';
import { Card, PageHeader, Badge, PrimaryButton, GhostButton, inputCls, Field, fmtNum } from './ui';
import { Megaphone, Bell, MessageCircle, MessageSquare, Mail, Send, CalendarClock, Save } from 'lucide-react';

const CHANNELS: { id: BroadcastChannel; label: string; icon: React.FC<{ className?: string }>; note: string }[] = [
  { id: 'PUSH', label: 'Push', icon: Bell, note: 'Free · FCM / APNs' },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle, note: 'Approved template required' },
  { id: 'SMS', label: 'SMS', icon: MessageSquare, note: 'DLT template required' },
  { id: 'EMAIL', label: 'Email', icon: Mail, note: 'Transactional sender' }
];

const SEGMENTS: { id: BroadcastSegment; label: string }[] = [
  { id: 'ALL', label: 'All merchants' },
  { id: 'FREE', label: 'Free plan users' },
  { id: 'PAID', label: 'Paid merchants' },
  { id: 'TRIAL_EXPIRING', label: 'Trials ending in 3 days' },
  { id: 'PAST_DUE', label: 'Past-due subscriptions' },
  { id: 'INACTIVE_14D', label: 'Inactive for 14+ days' },
  { id: 'EINVOICE_ELIGIBLE', label: 'AATO > ₹5 Cr (e-invoice mandatory)' }
];

const segmentSize = (s: BroadcastSegment): number => {
  switch (s) {
    case 'ALL': return PLATFORM_TOTALS.merchants;
    case 'FREE': return PLATFORM_TOTALS.planMix.free;
    case 'PAID': return PLATFORM_TOTALS.paidMerchants;
    case 'TRIAL_EXPIRING': return 312;
    case 'PAST_DUE': return 486;
    case 'INACTIVE_14D': return 6820;
    case 'EINVOICE_ELIGIBLE': return 2210;
  }
};

const MAX_SMS = 160;

export const Broadcasts: React.FC = () => {
  const { broadcasts, createBroadcast } = useAdmin();
  const [form, setForm] = useState({
    title: '',
    message: '',
    channels: ['PUSH'] as BroadcastChannel[],
    segment: 'ALL' as BroadcastSegment,
    language: 'English' as Broadcast['language'],
    scheduledAt: ''
  });

  const recipients = segmentSize(form.segment);
  const valid = form.title.trim() && form.message.trim() && form.channels.length > 0;
  const smsTooLong = form.channels.includes('SMS') && form.message.length > MAX_SMS;
  const costEstimate = useMemo(() => {
    const per: Record<BroadcastChannel, number> = { PUSH: 0, WHATSAPP: 0.79, SMS: 0.18, EMAIL: 0.02 };
    return form.channels.reduce((a, c) => a + per[c] * recipients, 0);
  }, [form.channels, recipients]);

  const submit = (status: Broadcast['status']) => {
    if (!valid) return;
    if (status === 'SENT' && !window.confirm(`Send "${form.title}" to ${fmtNum(recipients)} merchants now?`)) return;
    createBroadcast({
      title: form.title.trim(),
      message: form.message.trim(),
      channels: form.channels,
      segment: form.segment,
      language: form.language,
      status,
      scheduledAt: status === 'SCHEDULED' ? form.scheduledAt.replace('T', ' ') : undefined,
      recipients
    });
    setForm({ ...form, title: '', message: '', scheduledAt: '' });
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={Megaphone}
        title="Broadcast notifications"
        subtitle="Send push, WhatsApp, SMS or email to merchant segments: GST due-date reminders, trial nudges, festive offers, outage notices"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3 p-5 space-y-4 text-xs">
          <h3 className="font-extrabold text-sm text-ink">Compose</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title">
              <input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="GSTR-3B due 20 Nov" />
            </Field>
            <Field label="Language">
              <select className={inputCls} value={form.language} onChange={e => setForm({ ...form, language: e.target.value as Broadcast['language'] })}>
                <option>English</option>
                <option>Hindi</option>
              </select>
            </Field>
          </div>
          <Field label="Message" hint={`${form.message.length} characters${form.channels.includes('SMS') ? ` · SMS limit ${MAX_SMS}` : ''}`}>
            <textarea
              rows={4}
              className={`${inputCls} ${smsTooLong ? 'border-rose-400' : ''}`}
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder={form.language === 'Hindi' ? 'नमस्ते! आपका GSTR-3B 20 नवंबर तक फाइल करना है…' : 'Hi! Your GSTR-3B for October is due on 20 Nov…'}
            />
          </Field>
          {smsTooLong && <div className="text-[11px] text-rose-600 font-semibold">Message exceeds one SMS segment. It will be split and billed as multiple SMS.</div>}

          <div>
            <span className="block text-[11px] font-semibold text-stone-500 mb-1.5">Channels</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CHANNELS.map(c => {
                const on = form.channels.includes(c.id);
                const Icon = c.icon;
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setForm({ ...form, channels: on ? form.channels.filter(x => x !== c.id) : [...form.channels, c.id] })}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${on ? 'border-mango-400 bg-mango-50' : 'border-mango-100 hover:bg-mango-50/50'}`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-ink"><Icon className="w-3.5 h-3.5 text-mango-600" />{c.label}</div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{c.note}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Audience segment">
              <select className={inputCls} value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value as BroadcastSegment })}>
                {SEGMENTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Schedule (optional)">
              <input type="datetime-local" className={inputCls} value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-mango-100">
            <div className="text-[11px] text-stone-600">
              <span className="font-bold text-ink">{fmtNum(recipients)}</span> recipients · est. cost{' '}
              <span className="font-mono font-bold text-ink">₹{fmtNum(Math.round(costEstimate))}</span>
            </div>
            <div className="flex gap-2">
              <GhostButton onClick={() => submit('DRAFT')} disabled={!valid}><Save className="w-3.5 h-3.5" /> Save draft</GhostButton>
              <GhostButton onClick={() => submit('SCHEDULED')} disabled={!valid || !form.scheduledAt}><CalendarClock className="w-3.5 h-3.5" /> Schedule</GhostButton>
              <PrimaryButton onClick={() => submit('SENT')} disabled={!valid}><Send className="w-3.5 h-3.5" /> Send now</PrimaryButton>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <h3 className="font-extrabold text-sm text-ink mb-3">Preview</h3>
          <div className="mx-auto max-w-[280px] rounded-[28px] border-[6px] border-ink bg-cream p-3 shadow-xl">
            <div className="bg-white rounded-2xl p-3 shadow-sm border border-mango-100">
              <div className="flex items-center gap-2">
                <img src="/logo.jpeg" alt="" className="w-6 h-6 rounded-md object-cover" />
                <span className="text-[10px] font-bold text-stone-500">Mango Invoice · now</span>
              </div>
              <div className="text-xs font-bold text-ink mt-2">{form.title || 'Notification title'}</div>
              <div className="text-[11px] text-stone-600 mt-0.5 whitespace-pre-wrap">{form.message || 'Your message will appear here.'}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-extrabold text-sm text-ink mb-3">History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Broadcast</th>
                <th className="p-3">Segment</th>
                <th className="p-3">Channels</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Recipients</th>
                <th className="p-3 text-right">Delivered</th>
                <th className="p-3 text-right">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mango-100">
              {broadcasts.map(b => (
                <tr key={b.id}>
                  <td className="p-3">
                    <div className="font-bold text-ink">{b.title}</div>
                    <div className="text-[10px] text-stone-500 line-clamp-1 max-w-sm">{b.message}</div>
                  </td>
                  <td className="p-3 text-[11px]">{SEGMENTS.find(s => s.id === b.segment)?.label}</td>
                  <td className="p-3 text-[10px]">{b.channels.join(', ')}</td>
                  <td className="p-3">
                    <Badge tone={b.status === 'SENT' ? 'leaf' : b.status === 'SCHEDULED' ? 'wave' : 'stone'}>{b.status}</Badge>
                    <div className="text-[10px] text-stone-500 mt-0.5">{b.sentAt ?? b.scheduledAt ?? ''}</div>
                  </td>
                  <td className="p-3 text-right font-mono">{fmtNum(b.recipients)}</td>
                  <td className="p-3 text-right font-mono">{b.status === 'SENT' ? `${((b.delivered / b.recipients) * 100).toFixed(1)}%` : '—'}</td>
                  <td className="p-3 text-right font-mono">{b.status === 'SENT' && b.delivered ? `${((b.opened / b.delivered) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
