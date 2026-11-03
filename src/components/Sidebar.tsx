import React from 'react';
import { useBilling } from '../context/BillingContext';
import { TRANSLATIONS } from '../utils/formatters';
import {
  LayoutDashboard,
  Receipt,
  FileSpreadsheet,
  Truck,
  Boxes,
  Users2,
  Wallet,
  FileCheck2,
  CreditCard,
  Terminal,
  Settings,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'invoices'
  | 'quotations'
  | 'eway'
  | 'inventory'
  | 'parties'
  | 'payments'
  | 'gst'
  | 'subscriptions'
  | 'api'
  | 'audit';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { language, invoices, products, activeBusiness } = useBilling();
  const t = TRANSLATIONS[language];

  const lowStockCount = products.filter(p => p.currentStock <= p.minStockAlert).length;
  const unpaidCount = invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length;

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number; badgeColor?: string }[] = [
    {
      id: 'dashboard',
      label: t.dashboard,
      icon: LayoutDashboard
    },
    {
      id: 'invoices',
      label: t.invoices,
      icon: Receipt,
      badge: unpaidCount > 0 ? unpaidCount : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
    },
    {
      id: 'quotations',
      label: t.quotations,
      icon: FileSpreadsheet
    },
    {
      id: 'eway',
      label: t.eWayEInvoice,
      icon: Truck,
      badge: 'NIC'
    },
    {
      id: 'inventory',
      label: t.inventory,
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    },
    {
      id: 'parties',
      label: t.parties,
      icon: Users2
    },
    {
      id: 'payments',
      label: t.payments,
      icon: Wallet
    },
    {
      id: 'gst',
      label: t.gstReports,
      icon: FileCheck2
    },
    {
      id: 'subscriptions',
      label: t.subscriptions,
      icon: CreditCard
    },
    {
      id: 'api',
      label: t.androidApi,
      icon: Terminal,
      badge: 'REST',
      badgeColor: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
    },
    {
      id: 'audit',
      label: t.auditLogs,
      icon: Settings
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 no-print">
      {/* Brand Logo & Name */}
      <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/20">
          G
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-base tracking-tight text-white">{t.appName}</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-emerald-500/30 uppercase">
              Admin
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
            {language === 'hi' ? 'जीएसटी बिलिंग सिस्टम' : 'GST Billing & API Backend'}
          </p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {language === 'hi' ? 'मुख्य मेनू (Core Modules)' : 'Core Modules'}
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-emerald-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : item.badgeColor || 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Plan & Footer Box */}
      <div className="p-3 border-t border-slate-800">
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300">
              {activeBusiness.activePlan} Plan
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {language === 'hi' ? 'वैधता: ' : 'Valid: '}{activeBusiness.planValidUntil}
          </p>
          <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center">
              <ShieldCheck className="w-3 h-3 text-emerald-400 mr-1" /> GST Verified
            </span>
            <span className="font-mono">v3.4.2</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
