import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { SUPPORT_AGENTS } from '../../data/adminData';
import { TicketStatus, TicketPriority, TicketCategory } from '../../types/admin';
import { Card, PageHeader, Badge, SegmentedTabs, PrimaryButton, inputCls, EmptyState } from './ui';
import { LifeBuoy, Send, MessageCircle, Mail, Phone, Smartphone, Search } from 'lucide-react';

const PRIORITY_TONE: Record<TicketPriority, 'rose' | 'amber' | 'wave' | 'stone'> = { URGENT: 'rose', HIGH: 'amber', MEDIUM: 'wave', LOW: 'stone' };
const STATUS_TONE: Record<TicketStatus, 'mango' | 'wave' | 'amber' | 'leaf' | 'stone'> = {
  OPEN: 'mango',
  IN_PROGRESS: 'wave',
  WAITING_ON_MERCHANT: 'amber',
  RESOLVED: 'leaf',
  CLOSED: 'stone'
};
const CATEGORY_LABEL: Record<TicketCategory, string> = {
  E_INVOICE: 'e-Invoice',
  EWAY_BILL: 'e-Way bill',
  GSTR_FILING: 'GSTR filing',
  SUBSCRIPTION: 'Subscription',
  APP_BUG: 'App bug',
  PRINTING: 'Printing',
  ACCOUNT: 'Account'
};
const CHANNEL_ICON = { WHATSAPP: MessageCircle, EMAIL: Mail, CALL: Phone, IN_APP: Smartphone };
const PRIORITY_ORDER: TicketPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

const CANNED = [
  'Namaste! Hum is issue ko check kar rahe hain, 30 minute mein update denge.',
  'Please app ko latest version (v3.4.2) par update karke dobara try karein.',
  'Issue resolve ho gaya hai. Kripya confirm karein ki ab sab theek hai.',
  'Could you share a screenshot of the error and the invoice number?'
];

export const SupportTickets: React.FC = () => {
  const { tickets, replyTicket, setTicketStatus, assignTicket } = useAdmin();
  const [filter, setFilter] = useState<'ACTIVE' | 'UNASSIGNED' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  const [reply, setReply] = useState('');
  const [agent, setAgent] = useState(SUPPORT_AGENTS[0]);

  const isActive = (s: TicketStatus) => s === 'OPEN' || s === 'IN_PROGRESS' || s === 'WAITING_ON_MERCHANT';

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter(t =>
        filter === 'ALL' ? true :
        filter === 'ACTIVE' ? isActive(t.status) :
        filter === 'UNASSIGNED' ? t.assignee === 'Unassigned' && isActive(t.status) :
        !isActive(t.status)
      )
      .filter(t => !q || [t.ticketNo, t.subject, t.merchantName].some(v => v.toLowerCase().includes(q)))
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || b.updatedAt.localeCompare(a.updatedAt));
  }, [tickets, filter, query]);

  const selected = tickets.find(t => t.id === selectedId) ?? null;

  const send = () => {
    if (!selected || !reply.trim()) return;
    replyTicket(selected.id, reply.trim(), agent);
    setReply('');
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={LifeBuoy}
        title="Support tickets"
        subtitle="WhatsApp, in-app, email and call tickets from merchants — prioritised, assignable, with canned Hinglish replies"
        actions={
          <div className="flex gap-2 text-[11px]">
            <Badge tone="rose">{tickets.filter(t => t.priority === 'URGENT' && isActive(t.status)).length} urgent</Badge>
            <Badge tone="mango">{tickets.filter(t => isActive(t.status)).length} open</Badge>
            <Badge tone="stone">{tickets.filter(t => t.assignee === 'Unassigned' && isActive(t.status)).length} unassigned</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 p-3 space-y-3 h-fit">
          <SegmentedTabs
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'ACTIVE', label: 'Open' },
              { id: 'UNASSIGNED', label: 'Unassigned' },
              { id: 'RESOLVED', label: 'Resolved' },
              { id: 'ALL', label: 'All' }
            ]}
          />
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ticket no, subject, merchant…" className={`${inputCls} pl-8`} />
          </div>
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {list.map(t => {
              const Icon = CHANNEL_ICON[t.channel];
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    t.id === selectedId ? 'border-mango-400 bg-mango-50' : 'border-mango-100 hover:bg-mango-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-stone-500">{t.ticketNo}</span>
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                  </div>
                  <div className="text-xs font-bold text-ink mt-1 line-clamp-2">{t.subject}</div>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-stone-500">
                    <span className="flex items-center gap-1 truncate"><Icon className="w-3 h-3 shrink-0" />{t.merchantName}</span>
                    <Badge tone={STATUS_TONE[t.status]}>{t.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </button>
              );
            })}
            {list.length === 0 && <EmptyState text="No tickets here." />}
          </div>
        </Card>

        <Card className="lg:col-span-3 flex flex-col min-h-[560px]">
          {!selected ? (
            <EmptyState text="Select a ticket" />
          ) : (
            <>
              <div className="p-4 border-b border-mango-100 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] text-stone-500">{selected.ticketNo} · {CATEGORY_LABEL[selected.category]} · via {selected.channel.replace('_', '-').toLowerCase()}</div>
                    <h3 className="font-extrabold text-sm text-ink mt-0.5">{selected.subject}</h3>
                    <div className="text-[11px] text-stone-500 mt-0.5">{selected.merchantName} · {selected.phone}</div>
                  </div>
                  <a
                    href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-leaf-700 bg-leaf-50 border border-leaf-100 px-2.5 py-1.5 rounded-lg"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={selected.status} onChange={e => setTicketStatus(selected.id, e.target.value as TicketStatus)} className={`${inputCls} w-auto`}>
                    {(['OPEN', 'IN_PROGRESS', 'WAITING_ON_MERCHANT', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <select value={selected.assignee} onChange={e => assignTicket(selected.id, e.target.value)} className={`${inputCls} w-auto`}>
                    {SUPPORT_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <Badge tone={PRIORITY_TONE[selected.priority]} className="self-center">{selected.priority}</Badge>
                </div>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-cream/60">
                {selected.messages.map(m => (
                  <div key={m.id} className={`flex ${m.from === 'AGENT' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs ${
                        m.from === 'AGENT'
                          ? 'bg-mango-500 text-white rounded-br-sm'
                          : m.from === 'SYSTEM'
                          ? 'bg-wave-50 text-wave-700 border border-blue-100 font-mono text-[11px]'
                          : 'bg-white border border-mango-100 text-ink rounded-bl-sm'
                      }`}
                    >
                      <div className={`text-[10px] font-bold mb-0.5 ${m.from === 'AGENT' ? 'text-white/85' : 'text-stone-500'}`}>{m.author} · {m.at}</div>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-mango-100 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {CANNED.map(c => (
                    <button key={c} onClick={() => setReply(c)} className="text-[10px] px-2 py-1 rounded-lg bg-mango-50 hover:bg-mango-100 text-stone-600 border border-mango-100 max-w-[220px] truncate">
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select value={agent} onChange={e => setAgent(e.target.value)} className={`${inputCls} w-40`}>
                    {SUPPORT_AGENTS.filter(a => a !== 'Unassigned').map(a => <option key={a}>{a}</option>)}
                  </select>
                  <input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="Type a reply…"
                    className={inputCls}
                  />
                  <PrimaryButton onClick={send} disabled={!reply.trim()}><Send className="w-3.5 h-3.5" /> Send</PrimaryButton>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
