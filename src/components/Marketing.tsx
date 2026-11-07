import React, { useEffect, useState } from 'react';
import { Coins, Contact, Film, Megaphone } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { api, ApiError } from '../lib/api';
import { formatINR } from '../utils/formatters';
import { label, PLATFORM_LABEL, stamp, useSnapshot } from '../lib/snapshot';
import { AppSnapshot } from '../types/snapshot';
import { Card, EmptyRow, PageHeader, Pill, ReadOnlyNote, SnapshotGate, Stats, Tabs, Th, THead, Tone } from './ui';

const AD_TONE: Record<string, Tone> = { DRAFT: 'grey', POSTED: 'blue', LIVE: 'green', PAUSED: 'amber', ENDED: 'grey' };

/** Coin recharge orders recorded by the server (POST /api/v1/coins/checkout → payment gateway). */
interface CoinOrder { id: string; packId: string; coins: number; amount: number; status: 'pending' | 'paid' | 'failed' | 'refunded'; createdAt: string; paidAt?: string | null; gatewayRef?: string }

export const Marketing: React.FC = () => {
  const { language, activeBusiness } = useBilling();
  const hi = language === 'hi';
  const state = useSnapshot();
  const [tab, setTab] = useState<'coins' | 'ads' | 'videos' | 'card' | 'desk'>('coins');
  return (
    <div className="space-y-6">
      <PageHeader icon={<Megaphone className="w-5 h-5 text-emerald-400" />} title={hi ? 'मार्केटिंग, विज्ञापन व कॉइन' : 'Marketing, ads & coins'}
        subtitle={hi ? `${activeBusiness.name}: कॉइन वॉलेट, AI वीडियो, Instagram/Facebook/YouTube/Google विज्ञापन और विज़िटिंग कार्ड`
          : `${activeBusiness.name}: coin wallet, AI videos, Instagram / Facebook / YouTube / Google ads and the visiting card`}
        right={<Tabs tabs={[['coins', hi ? 'कॉइन' : 'Coins'], ['ads', hi ? 'विज्ञापन' : 'Ads'], ['videos', hi ? 'AI वीडियो' : 'AI videos'], ['card', hi ? 'विज़िटिंग कार्ड' : 'Visiting card'], ['desk', hi ? 'ऐड डेस्क (सभी)' : 'Ads desk (all)']]} value={tab} onChange={setTab} />} />
      {tab === 'desk' ? <AdsDesk hi={hi} /> : <SnapshotGate state={state}>{(s) => (
        tab === 'coins' ? <CoinsTab s={s} hi={hi} /> : tab === 'ads' ? <AdsTab s={s} hi={hi} /> : tab === 'videos' ? <VideosTab s={s} hi={hi} /> : <CardTab s={s} hi={hi} />
      )}</SnapshotGate>}
      {tab !== 'desk' && <ReadOnlyNote updatedAt={state.updatedAt} />}
    </div>
  );
};

interface DeskCampaign {
  id: string; businessName: string; name: string; objective: string; dailyBudget: number; days: number; radiusKm: number; caption: string;
  platforms: string[]; connected: string[]; status: string; createdAt: string;
}
const DESK_TONE: Record<string, Tone> = { queued: 'amber', live: 'green', paused: 'blue', ended: 'grey', rejected: 'red' };

/** Paid campaigns businesses submitted from the app; the Mango ads team launches them with the connected accounts. */
const AdsDesk: React.FC<{ hi: boolean }> = ({ hi }) => {
  const { can, showToast } = useBilling();
  const canEdit = can('marketing', 'edit');
  const [rows, setRows] = useState<DeskCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api<{ data: DeskCampaign[] }>('/ads/campaigns').then((r) => setRows(r.data)).catch((e: ApiError) => setError(e.message));
  }, [tick]);
  const set = async (c: DeskCampaign, status: string) => {
    try { await api(`/ads/campaigns/${c.id}`, { method: 'PATCH', body: { status } }); setTick((t) => t + 1); } catch (e) { showToast((e as Error).message); }
  };
  if (error) return <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">{error}</div>;
  return (
    <Card title={hi ? 'ऐड डेस्क — ऐप से आए पेड कैंपेन' : 'Ads desk — paid campaigns from the app'} icon={<Megaphone className="w-4 h-4 text-emerald-400" />}>
      <table className="w-full text-left text-xs text-slate-300">
        <THead><Th first>{hi ? 'बिजनेस' : 'Business'}</Th><Th>{hi ? 'कैंपेन' : 'Campaign'}</Th><Th>{hi ? 'प्लेटफ़ॉर्म' : 'Platforms'}</Th><Th>{hi ? 'बजट' : 'Budget'}</Th><Th>Status</Th><Th right> </Th></THead>
        <tbody className="divide-y divide-slate-800">
          {(rows ?? []).map((c) => (
            <tr key={c.id}>
              <td className="p-3 pl-5 font-bold text-white">{c.businessName}<span className="block text-[10px] font-normal text-slate-500">{new Date(c.createdAt).toLocaleString('en-IN')}</span></td>
              <td className="p-3"><div className="text-white font-semibold">{c.name}</div><div className="text-[10px] text-slate-500 max-w-xs truncate">{label(c.objective)} · {c.caption}</div></td>
              <td className="p-3">{c.platforms.map((p) => <span key={p} className="mr-1"><Pill tone={c.connected.includes(p) ? 'green' : 'red'}>{PLATFORM_LABEL[p] ?? p}</Pill></span>)}</td>
              <td className="p-3">{formatINR(c.dailyBudget)}/day × {c.days}<span className="block text-[10px] text-slate-500">{c.radiusKm} km</span></td>
              <td className="p-3"><Pill tone={DESK_TONE[c.status] ?? 'grey'}>{c.status}</Pill></td>
              <td className="p-3 pr-5 text-right">{canEdit && (
                <select value={c.status} onChange={(e) => set(c, e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white">
                  {['queued', 'live', 'paused', 'ended', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}</td>
            </tr>
          ))}
          {rows?.length === 0 && <EmptyRow cols={6} text={hi ? 'कोई कैंपेन नहीं' : 'No campaigns queued'} />}
        </tbody>
      </table>
      <p className="px-5 py-2 text-[10px] text-slate-500">{hi ? 'हरा = अकाउंट जुड़ा है। विज्ञापन प्लेटफ़ॉर्म के Ads Manager में लॉन्च करें।' : 'Green = account connected. Launch in the platform’s Ads Manager, then set the status here.'}</p>
    </Card>
  );
};

const CoinsTab: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const { activeBusiness } = useBilling();
  const tx = s.extras.coinTxns;
  const balance = tx.reduce((a, t) => a + t.coins, 0);
  const bought = tx.filter((t) => t.coins > 0 && t.paid > 0);
  const test = tx.filter((t) => !t.verified);
  const spentBy = new Map<string, number>();
  tx.filter((t) => t.coins < 0).forEach((t) => { const k = t.reason.split(' · ')[0]; spentBy.set(k, (spentBy.get(k) ?? 0) - t.coins); });
  const [orders, setOrders] = useState<CoinOrder[] | null>(null);
  const [ordersMissing, setOrdersMissing] = useState(false);
  useEffect(() => {
    setOrders(null); setOrdersMissing(false);
    api<{ data: CoinOrder[] } | CoinOrder[]>(`/businesses/${activeBusiness.id}/coin-orders`)
      .then((r) => setOrders(Array.isArray(r) ? r : r.data)).catch((e: ApiError) => { if (e.status === 404) setOrdersMissing(true); else setOrders([]); });
  }, [activeBusiness.id]);
  return (
    <>
      <Stats items={[
        [hi ? 'बैलेंस' : 'Balance', `${balance} coins`],
        [hi ? 'ख़रीदे' : 'Bought', bought.reduce((a, t) => a + t.coins, 0), formatINR(bought.reduce((a, t) => a + t.paid, 0))],
        [hi ? 'ख़र्च' : 'Spent', -tx.filter((t) => t.coins < 0).reduce((a, t) => a + t.coins, 0)],
        [hi ? 'टेस्ट कॉइन' : 'Test coins', test.reduce((a, t) => a + t.coins, 0), test.length ? (hi ? 'डिबग बिल्ड से' : 'from a debug build') : undefined],
      ]} />
      {test.length > 0 && <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl p-3">{hi ? 'इस बिजनेस के पास बिना भुगतान वाले टेस्ट कॉइन हैं (डिबग ऐप से)।' : 'This business has unpaid test coins (added by a debug build of the app).'}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={hi ? 'कॉइन लेन-देन' : 'Coin ledger'} icon={<Coins className="w-4 h-4 text-amber-400" />}>
            <table className="w-full text-left text-xs text-slate-300">
              <THead><Th first>{hi ? 'समय' : 'When'}</Th><Th>{hi ? 'कारण' : 'Reason'}</Th><Th>{hi ? 'भुगतान' : 'Paid'}</Th><Th right>Coins</Th></THead>
              <tbody className="divide-y divide-slate-800">
                {tx.slice(0, 60).map((t) => (
                  <tr key={t.id}><td className="p-3 pl-5 text-[11px]">{stamp(t.at)}</td><td className="p-3">{t.reason}{!t.verified && <> <Pill tone="amber">test</Pill></>}</td>
                    <td className="p-3">{t.paid ? formatINR(t.paid) : '—'}</td><td className={`p-3 pr-5 text-right font-bold ${t.coins > 0 ? 'text-emerald-400' : 'text-rose-300'}`}>{t.coins > 0 ? '+' : ''}{t.coins}</td></tr>
                ))}
                {tx.length === 0 && <EmptyRow cols={4} text="—" />}
              </tbody>
            </table>
          </Card>
        </div>
        <Card title={hi ? 'कहाँ ख़र्च हुए' : 'Spent on'}>
          <table className="w-full text-xs text-slate-300"><tbody className="divide-y divide-slate-800">
            {[...spentBy.entries()].map(([k, v]) => <tr key={k}><td className="p-3 pl-5">{k}</td><td className="p-3 pr-5 text-right font-bold">{v}</td></tr>)}
            {spentBy.size === 0 && <EmptyRow cols={2} text="—" />}
          </tbody></table>
        </Card>
      </div>
      <Card title={hi ? 'रिचार्ज भुगतान (सर्वर)' : 'Recharge payments (server)'}>
        {ordersMissing ? <p className="p-4 text-xs text-amber-200">{hi ? 'बैकएंड में GET /api/admin/businesses/:id/coin-orders नहीं है।' : 'Backend has no GET /api/admin/businesses/:id/coin-orders yet.'}</p> : (
          <table className="w-full text-left text-xs text-slate-300">
            <THead><Th first>{hi ? 'ऑर्डर' : 'Order'}</Th><Th>{hi ? 'पैक' : 'Pack'}</Th><Th>{hi ? 'रकम' : 'Amount'}</Th><Th>{hi ? 'गेटवे रेफ़' : 'Gateway ref'}</Th><Th right>Status</Th></THead>
            <tbody className="divide-y divide-slate-800">
              {(orders ?? []).map((o) => (
                <tr key={o.id}><td className="p-3 pl-5 font-mono text-[11px]">{o.id}<span className="block text-slate-500">{new Date(o.createdAt).toLocaleString('en-IN')}</span></td>
                  <td className="p-3">{o.coins} coins</td><td className="p-3">{formatINR(o.amount)}</td><td className="p-3 font-mono text-[11px]">{o.gatewayRef ?? '—'}</td>
                  <td className="p-3 pr-5 text-right"><Pill tone={o.status === 'paid' ? 'green' : o.status === 'pending' ? 'amber' : 'red'}>{o.status}</Pill></td></tr>
              ))}
              {orders?.length === 0 && <EmptyRow cols={5} text="—" />}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
};

const AdsTab: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const c = s.extras.campaigns;
  const spend = c.reduce((a, x) => a + x.spend, 0), leads = c.reduce((a, x) => a + x.leads, 0);
  return (
    <>
      <Stats items={[
        [hi ? 'कैंपेन' : 'Campaigns', c.length, `${c.filter((x) => x.status === 'LIVE').length} live`],
        [hi ? 'ख़र्च' : 'Spend', formatINR(spend)],
        [hi ? 'पहुँच' : 'Reach', c.reduce((a, x) => a + x.reach, 0).toLocaleString('en-IN')],
        [hi ? 'लीड' : 'Leads', leads, leads ? `${formatINR(spend / leads)}/lead` : undefined],
      ]} />
      <Card title={hi ? 'जुड़े अकाउंट' : 'Connected accounts'}>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {(['INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'GOOGLE'] as const).map((p) => {
            const a = s.extras.adAccounts.find((x) => x.platform === p);
            return (
              <div key={p} className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex justify-between items-center"><span className="font-bold text-white">{PLATFORM_LABEL[p]}</span><Pill tone={a?.connected ? 'green' : 'grey'}>{a?.connected ? (hi ? 'जुड़ा' : 'Connected') : (hi ? 'नहीं' : 'Not connected')}</Pill></div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">{a?.handle || '—'}{a?.adAccountId ? ` · ${a.adAccountId}` : ''}</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title={hi ? 'कैंपेन' : 'Campaigns'} icon={<Megaphone className="w-4 h-4 text-emerald-400" />}>
        <table className="w-full text-left text-xs text-slate-300">
          <THead><Th first>{hi ? 'नाम' : 'Name'}</Th><Th>{hi ? 'प्लेटफ़ॉर्म' : 'Platforms'}</Th><Th>{hi ? 'बजट' : 'Budget'}</Th><Th>{hi ? 'ख़र्च' : 'Spend'}</Th><Th>{hi ? 'पहुँच / लीड' : 'Reach / leads'}</Th><Th right>Status</Th></THead>
          <tbody className="divide-y divide-slate-800">
            {c.map((x) => (
              <tr key={x.id}>
                <td className="p-3 pl-5"><div className="font-bold text-white">{x.name}</div><div className="text-[10px] text-slate-400">{label(x.objective)} · {stamp(x.createdAt)}{x.videoId ? ' · AI video' : ''}</div></td>
                <td className="p-3">{x.platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}</td>
                <td className="p-3">{x.dailyBudget ? `${formatINR(x.dailyBudget)}/day × ${x.days}` : (hi ? 'फ्री पोस्ट' : 'Free post')}<span className="block text-[10px] text-slate-500">{x.radiusKm} km</span></td>
                <td className="p-3">{formatINR(x.spend)}</td>
                <td className="p-3">{x.reach.toLocaleString('en-IN')} / {x.leads}</td>
                <td className="p-3 pr-5 text-right"><Pill tone={AD_TONE[x.status]}>{label(x.status)}</Pill></td>
              </tr>
            ))}
            {c.length === 0 && <EmptyRow cols={6} text={hi ? 'कोई कैंपेन नहीं' : 'No campaigns'} />}
          </tbody>
        </table>
      </Card>
    </>
  );
};

const VideosTab: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => (
  <Card title={hi ? 'AI वीडियो' : 'AI videos'} icon={<Film className="w-4 h-4 text-emerald-400" />}>
    <table className="w-full text-left text-xs text-slate-300">
      <THead><Th first>{hi ? 'शीर्षक' : 'Title'}</Th><Th>{hi ? 'सीन' : 'Scenes'}</Th><Th>{hi ? 'स्टाइल' : 'Style'}</Th><Th>{hi ? 'लंबाई' : 'Length'}</Th><Th right>Coins</Th></THead>
      <tbody className="divide-y divide-slate-800">
        {s.extras.videos.map((v) => (
          <tr key={v.id}>
            <td className="p-3 pl-5"><div className="font-bold text-white">{v.title}</div><div className="text-[10px] text-slate-500">{stamp(v.createdAt)}</div></td>
            <td className="p-3 text-[11px] max-w-md">{v.scenes.join(' · ')}</td>
            <td className="p-3">{v.style}</td><td className="p-3">{v.durationSec}s</td><td className="p-3 pr-5 text-right">{v.coins}</td>
          </tr>
        ))}
        {s.extras.videos.length === 0 && <EmptyRow cols={5} text={hi ? 'कोई वीडियो नहीं' : 'No videos yet'} />}
      </tbody>
    </table>
    <p className="px-5 py-2 text-[10px] text-slate-500">{hi ? 'वीडियो फ़ाइलें फ़ोन पर बनती और रहती हैं।' : 'Video files are rendered and stored on the phone.'}</p>
  </Card>
);

const CardTab: React.FC<{ s: AppSnapshot; hi: boolean }> = ({ s, hi }) => {
  const { activeBusiness } = useBilling();
  const c = s.extras.card;
  const paidPlan = (activeBusiness.planName ?? activeBusiness.activePlan ?? 'FREE').toUpperCase() !== 'FREE';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title={hi ? 'डिजिटल विज़िटिंग कार्ड' : 'Digital visiting card'} icon={<Contact className="w-4 h-4 text-emerald-400" />}>
        {c.name || c.phone ? (
          <div className="p-5">
            <div className={`rounded-2xl p-6 aspect-[1050/600] flex flex-col justify-between ${c.design === 'DARK' ? 'bg-gradient-to-br from-[#1E1B2E] to-[#0B0A12] text-[#ffffff]' : c.design === 'MANGO' ? 'bg-gradient-to-br from-[#ffb020] to-[#f2581e] text-[#ffffff]' : 'bg-gradient-to-br from-[#fff6ec] to-[#ffe8cf] text-[#1d1a17]'}`}>
              <div><p className="font-black text-lg">{s.business.name}</p>{c.tagline && <p className="text-xs opacity-80">{c.tagline}</p>}</div>
              <div><p className="font-black text-2xl">{c.name}</p>{c.title && <p className="text-xs opacity-80">{c.title}</p>}</div>
              <div className="text-xs space-y-0.5 opacity-90">{[c.phone, c.email, c.website, c.address].filter(Boolean).map((l) => <p key={l}>{l}</p>)}</div>
            </div>
          </div>
        ) : <p className="p-6 text-center text-xs text-slate-400">{hi ? 'अभी कार्ड नहीं बनाया' : 'No card created yet'}</p>}
      </Card>
      <Card title={hi ? 'प्रीमियम एक्सेस' : 'Premium access'}>
        <table className="w-full text-xs text-slate-300"><tbody className="divide-y divide-slate-800">
          <tr><td className="p-3 pl-5">{hi ? 'डिज़ाइन' : 'Design'}</td><td className="p-3 pr-5 text-right">{label(c.design)}</td></tr>
          <tr><td className="p-3 pl-5">{hi ? 'प्लान' : 'Plan'}</td><td className="p-3 pr-5 text-right"><Pill tone={paidPlan ? 'green' : 'grey'}>{activeBusiness.planName ?? activeBusiness.activePlan}</Pill></td></tr>
          <tr><td className="p-3 pl-5">{hi ? 'कॉइन से अनलॉक' : 'Unlocked with coins'}</td><td className="p-3 pr-5 text-right">{s.extras.cardUnlocked ? (hi ? 'हाँ' : 'Yes') : (hi ? 'नहीं' : 'No')}</td></tr>
          <tr><td className="p-3 pl-5">{hi ? 'प्रीमियम डिज़ाइन मिलेंगे' : 'Premium designs available'}</td><td className="p-3 pr-5 text-right font-bold">{paidPlan || s.extras.cardUnlocked ? (hi ? 'हाँ' : 'Yes') : (hi ? 'नहीं' : 'No')}</td></tr>
        </tbody></table>
        <p className="px-5 py-3 text-[10px] text-slate-500">{hi ? 'पेड प्लान (Silver/Gold/Platinum) में प्रीमियम कार्ड शामिल हैं। प्लान "सब्सक्रिप्शन" स्क्रीन से बदलें।' : 'Paid plans (Silver / Gold / Platinum) include premium cards. Change the plan from Subscriptions.'}</p>
      </Card>
    </div>
  );
};
