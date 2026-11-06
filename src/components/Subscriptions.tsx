import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { formatINR } from '../utils/formatters';
import { Check, Minus, X } from 'lucide-react';
import { MangoPlan } from '../types';

const LIMIT_LABELS: Record<string, string> = {
  webAccess: 'Web access', allDocTypes: 'All document types', reminders: 'Payment reminders', gstReports: 'GSTR-1 / 3B reports',
  eWayBill: 'e-Way bills', eInvoice: 'e-Invoice (IRN)', bulkIrn: 'Bulk IRN', pos: 'Barcode & POS', caLogin: 'CA login', prioritySupport: 'Priority support',
};

/** Mango Invoice plans from the server; switch the selected business's plan (recorded in the audit log). */
export const Subscriptions: React.FC = () => {
  const { language, activeBusiness, plans, changePlan, showToast, can } = useBilling();
  const hi = language === 'hi';
  const [target, setTarget] = useState<MangoPlan | null>(null);
  const [months, setMonths] = useState(12);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canChange = can('subscriptions', 'edit');

  const totalBusinesses = plans.reduce((a, p) => a + p.businesses, 0);
  const currentId = activeBusiness.activePlan.toLowerCase();

  const submit = async () => {
    if (!target) return;
    if (reason.trim().length < 3) { showToast(hi ? 'कारण लिखें (कम से कम 3 अक्षर)' : 'Please enter a reason'); return; }
    setBusy(true);
    try { await changePlan(target.id, months, reason.trim()); setTarget(null); setReason(''); }
    catch (e) { showToast((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-center max-w-3xl mx-auto">
        <span className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 uppercase tracking-wider">
          {hi ? 'सब्सक्रिप्शन' : 'Subscriptions'}
        </span>
        <h2 className="text-2xl font-black text-white mt-3">
          {hi ? 'Mango Invoice प्लान्स' : 'Mango Invoice Plans'}
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          {hi
            ? `${totalBusinesses} बिजनेस ऐप पर हैं। चुने गए बिजनेस (${activeBusiness.name}) का प्लान यहाँ से बदलें। कीमतें 18% GST के बिना।`
            : `${totalBusinesses} businesses on the app. Change the plan for ${activeBusiness.name} here. Prices exclude 18% GST.`}
        </p>
        <p className="text-xs mt-3 text-slate-300">
          {hi ? 'वर्तमान प्लान' : 'Current plan'}: <strong className="text-emerald-400">{activeBusiness.planName ?? activeBusiness.activePlan}</strong>
          {activeBusiness.planStatus === 'trial' && <span className="text-indigo-300"> (trial)</span>}
          {activeBusiness.planValidUntil && <> · {hi ? 'वैधता' : 'valid till'} {new Date(activeBusiness.planValidUntil).toLocaleDateString('en-IN')}</>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const isCurrent = plan.id === currentId;
          return (
            <div key={plan.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                isCurrent ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500' : 'border-slate-800 hover:border-slate-700'}`}>
              {plan.tag && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow whitespace-nowrap">
                  {plan.tag}
                </span>
              )}
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-extrabold text-base text-white">{plan.name}</h3>
                  {isCurrent && <span className="bg-emerald-500/20 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded">Current</span>}
                </div>
                <div className="mt-4 mb-4">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-white">{formatINR(plan.priceYearly)}</span>
                    <span className="text-slate-400 text-xs">/{plan.tagline || 'year'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{plan.businesses} {hi ? 'बिजनेस इस प्लान पर' : 'businesses on this plan'}</p>
                </div>
                <div className="space-y-2 pt-3 border-t border-slate-800 text-xs text-slate-300">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center space-x-2 text-[11px]">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span>{f}</span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-slate-800/70 space-y-1.5">
                    <div className="text-[10px] text-slate-500">Users: <strong className="text-slate-300">{String(plan.limits.users)}</strong> · Businesses: <strong className="text-slate-300">{String(plan.limits.businesses)}</strong></div>
                    {Object.entries(LIMIT_LABELS).map(([k, label]) => (
                      <div key={k} className={`flex items-center space-x-2 text-[10.5px] ${plan.limits[k] ? 'text-slate-300' : 'text-slate-600'}`}>
                        {plan.limits[k] ? <Check className="w-3 h-3 text-emerald-400" /> : <Minus className="w-3 h-3" />}<span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-800">
                <button disabled={isCurrent || !canChange} onClick={() => { setTarget(plan); setMonths(12); }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    isCurrent || !canChange ? 'bg-slate-800 text-slate-500 cursor-default' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'}`}>
                  {isCurrent ? 'Active Plan' : canChange ? (hi ? `${plan.name} पर बदलें` : `Switch to ${plan.name}`) : (hi ? 'सिर्फ़ देखने की अनुमति' : 'View only')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm">{activeBusiness.name} → {target.name}</h3>
              <button onClick={() => setTarget(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-slate-400">
              {hi ? 'यह बिना भुगतान के प्लान बदलता है (कॉम्प्लिमेंटरी / सुधार)। ऑडिट लॉग में दर्ज होगा।'
                : 'Changes the plan without a payment (complimentary / correction). Recorded in the audit log.'}
            </p>
            {target.id !== 'free' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">{hi ? 'अवधि' : 'Duration'}</label>
                <select value={months} onChange={e => setMonths(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white">
                  {[1, 3, 6, 12, 24].map(m => <option key={m} value={m}>{m} {hi ? 'महीने' : 'months'}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">{hi ? 'कारण' : 'Reason'}</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                placeholder={hi ? 'जैसे: सिंक समस्या के लिए गुडविल' : 'e.g. Goodwill extension after sync issue'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setTarget(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">{hi ? 'रद्द करें' : 'Cancel'}</button>
              <button disabled={busy} onClick={submit} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold disabled:opacity-60">
                {busy ? '…' : hi ? 'प्लान बदलें' : 'Change plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
