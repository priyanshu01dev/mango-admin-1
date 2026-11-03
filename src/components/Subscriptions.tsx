import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { SUBSCRIPTION_PLANS } from '../data/mockData';
import { formatINR } from '../utils/formatters';
import { Check, ShieldCheck, Zap, Sparkles, Building2 } from 'lucide-react';

export const Subscriptions: React.FC = () => {
  const { language, activeBusiness, updateBusinessProfile, showToast } = useBilling();
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');

  const totalSubscribers = SUBSCRIPTION_PLANS.reduce((acc, p) => acc + p.activeUsersCount, 0);

  const handleSelectPlan = (planName: any) => {
    updateBusinessProfile({
      ...activeBusiness,
      activePlan: planName,
      planValidUntil: '2027-11-30'
    });
    showToast(language === 'hi' ? `प्लान सफलतापूर्वक ${planName} में अपग्रेड हुआ!` : `Plan upgraded to ${planName}!`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-center max-w-3xl mx-auto">
        <span className="bg-emerald-500/15 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 uppercase tracking-wider">
          SaaS Billing & Licensing
        </span>
        <h2 className="text-2xl font-black text-white mt-3">
          {language === 'hi' ? 'गिमबुक्स प्रो - बिजनेस सब्सक्रिप्शन प्लान्स' : 'GimBooks Pro Subscription Plans'}
        </h2>
        <p className="text-slate-400 text-xs mt-1">
          {language === 'hi'
            ? 'अपनी दुकान या बिजनेस की जरूरत के हिसाब से सही बिलिंग प्लान चुनें। वर्तमान में ' + totalSubscribers + ' एक्टिव बिजनेस जुड़े हैं।'
            : 'Power your retail or wholesale business with GST billing, e-invoicing and Android app sync.'}
        </p>

        {/* Billing cycle toggle */}
        <div className="mt-5 inline-flex items-center space-x-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              billingCycle === 'MONTHLY' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('YEARLY')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
              billingCycle === 'YEARLY' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Annual (Save 20%)</span>
            <span className="bg-emerald-700 text-white text-[9px] px-1 py-0.2 rounded">Save</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SUBSCRIPTION_PLANS.map(plan => {
          const isCurrent =
            (plan.id === 'plan-enterprise' && activeBusiness.activePlan === 'ENTERPRISE') ||
            (plan.id === 'plan-gold' && activeBusiness.activePlan === 'GROWTH') ||
            (plan.id === 'plan-silver' && activeBusiness.activePlan === 'STARTER') ||
            (plan.id === 'plan-free' && activeBusiness.activePlan === 'FREE_TRIAL');

          const price = billingCycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all relative ${
                isCurrent
                  ? 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow">
                  {plan.badge}
                </span>
              )}

              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-extrabold text-base text-white">{plan.name}</h3>
                  {isCurrent && (
                    <span className="bg-emerald-500/20 text-emerald-400 font-bold text-[10px] px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>

                <div className="mt-4 mb-4">
                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-white">{formatINR(price)}</span>
                    <span className="text-slate-400 text-xs">/{billingCycle === 'YEARLY' ? 'year' : 'month'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {plan.activeUsersCount} active Indian businesses
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center space-x-2 text-[11px]">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Invoices: <strong>{plan.invoiceLimit}</strong></span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>e-Way Bills: <strong>{plan.eWayBillLimit}</strong></span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Staff Logins: <strong>{plan.multiUserLimit} Users</strong></span>
                  </div>

                  {plan.features.map(f => (
                    <div key={f} className="flex items-center space-x-2 text-[11px] text-slate-400">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  disabled={isCurrent}
                  onClick={() => {
                    const targetPlan =
                      plan.id === 'plan-enterprise' ? 'ENTERPRISE' :
                      plan.id === 'plan-gold' ? 'GROWTH' :
                      plan.id === 'plan-silver' ? 'STARTER' : 'FREE_TRIAL';
                    handleSelectPlan(targetPlan);
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-slate-800 text-slate-500 cursor-default'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                  }`}
                >
                  {isCurrent ? 'Active Plan' : 'Switch to ' + plan.name}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
