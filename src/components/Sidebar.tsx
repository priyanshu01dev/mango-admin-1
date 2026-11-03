import React from 'react';
import { useBilling } from '../context/BillingContext';
import { useAdmin } from '../context/AdminContext';
import { useDocuments } from '../context/DocumentsContext';
import { useAuth } from '../context/AuthContext';
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
  ShieldCheck,
  Activity,
  Store,
  LifeBuoy,
  Flag,
  Megaphone,
  Plug,
  FileStack,
  ShoppingCart,
  BarChart3
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'merchants'
  | 'subscriptions'
  | 'support'
  | 'flags'
  | 'broadcasts'
  | 'integrations'
  | 'dashboard'
  | 'invoices'
  | 'quotations'
  | 'salesdocs'
  | 'purchases'
  | 'reports'
  | 'eway'
  | 'inventory'
  | 'parties'
  | 'payments'
  | 'gst'
  | 'api'
  | 'audit';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

type NavItem = { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number; badgeTone?: 'rose' | 'mango' | 'wave' };

const BADGE_TONE = {
  rose: 'bg-rose-50 text-rose-700 border border-rose-200',
  mango: 'bg-mango-50 text-mango-700 border border-mango-200',
  wave: 'bg-wave-50 text-wave-600 border border-blue-100'
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { language, invoices, products } = useBilling();
  const { tickets, merchants, integrations } = useAdmin();
  const { documents } = useDocuments();
  const { isPlatformAdmin, user } = useAuth();
  const t = TRANSLATIONS[language];
  const hi = language === 'hi';

  const lowStockCount = products.filter(p => p.currentStock <= p.minStockAlert).length;
  const unpaidCount = invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID').length;
  const openTickets = tickets.filter(x => x.status === 'OPEN' || x.status === 'IN_PROGRESS').length;
  const trials = merchants.filter(m => m.status === 'TRIAL').length;
  const openBills = documents.filter(d => d.docType === 'PURCHASE_BILL' && (d.status === 'UNPAID' || d.status === 'PARTIALLY_PAID')).length;
  const integrationErrors = integrations.filter(i => i.status === 'ERROR').length;

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: hi ? 'प्लेटफ़ॉर्म एडमिन' : 'Platform Admin',
      items: [
        { id: 'overview', label: hi ? 'ओवरव्यू व एनालिटिक्स' : 'Overview & Analytics', icon: Activity },
        { id: 'merchants', label: hi ? 'मर्चेंट्स' : 'Merchants', icon: Store, badge: trials ? `${trials} trial` : undefined, badgeTone: 'mango' },
        { id: 'subscriptions', label: t.subscriptions, icon: CreditCard },
        { id: 'support', label: hi ? 'सपोर्ट टिकट' : 'Support Tickets', icon: LifeBuoy, badge: openTickets || undefined, badgeTone: 'rose' },
        { id: 'flags', label: hi ? 'फ़ीचर फ़्लैग्स' : 'Feature Flags', icon: Flag },
        { id: 'broadcasts', label: hi ? 'ब्रॉडकास्ट' : 'Broadcasts', icon: Megaphone },
        { id: 'integrations', label: hi ? 'इंटीग्रेशन व GSP' : 'Integrations & GSP', icon: Plug, badge: integrationErrors ? '!' : undefined, badgeTone: 'rose' }
      ]
    },
    {
      title: hi ? 'मर्चेंट वर्कस्पेस' : 'Merchant Workspace',
      items: [
        { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
        { id: 'invoices', label: t.invoices, icon: Receipt, badge: unpaidCount || undefined, badgeTone: 'rose' },
        { id: 'quotations', label: t.quotations, icon: FileSpreadsheet },
        { id: 'salesdocs', label: hi ? 'प्रोफॉर्मा, चालान व क्रेडिट नोट' : 'Challans & Notes', icon: FileStack },
        { id: 'purchases', label: hi ? 'खरीद व खर्च' : 'Purchases & Expenses', icon: ShoppingCart, badge: openBills || undefined, badgeTone: 'rose' },
        { id: 'eway', label: t.eWayEInvoice, icon: Truck, badge: 'NIC', badgeTone: 'wave' },
        { id: 'inventory', label: t.inventory, icon: Boxes, badge: lowStockCount ? `${lowStockCount} low` : undefined, badgeTone: 'mango' },
        { id: 'parties', label: t.parties, icon: Users2 },
        { id: 'payments', label: t.payments, icon: Wallet },
        { id: 'gst', label: t.gstReports, icon: FileCheck2 },
        { id: 'reports', label: hi ? 'बिज़नेस रिपोर्ट्स' : 'Business Reports', icon: BarChart3 }
      ]
    },
    {
      title: hi ? 'सिस्टम' : 'System',
      items: [
        { id: 'api', label: t.androidApi, icon: Terminal, badge: 'REST', badgeTone: 'wave' },
        { id: 'audit', label: t.auditLogs, icon: Settings }
      ]
    }
  ];

  // merchants (no platform role) only see their own workspace
  const visibleSections = isPlatformAdmin ? sections : sections.slice(1);

  return (
    <aside className="w-64 bg-white/80 backdrop-blur border-r border-mango-100 flex flex-col shrink-0 no-print">
      <div className="p-4 border-b border-mango-100 flex items-center space-x-3">
        <img src="/logo.jpeg" alt="Mango Invoice Logo" className="w-11 h-11 rounded-xl object-cover shadow-md shadow-mango-500/20 border border-mango-100 shrink-0" />
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold text-base tracking-tight text-ink">
              Mango <span className="text-mango-600">Invoice</span>
            </span>
          </div>
          <p className="text-[10px] text-stone-500 font-medium">
            {hi ? 'सुपर एडमिन पैनल' : 'Super Admin Panel'}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {visibleSections.map(section => (
          <div key={section.title} className="space-y-0.5">
            <div className="px-3 pb-1 text-[10px] font-bold text-stone-400 uppercase tracking-wider">{section.title}</div>
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                    isActive ? 'bg-gradient-to-r from-mango-500 to-orange-500 text-white shadow-md shadow-mango-500/25' : 'text-stone-700 hover:bg-mango-50 hover:text-ink'
                  }`}
                >
                  <span className="flex items-center space-x-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-400 group-hover:text-mango-600'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/25 text-white' : BADGE_TONE[item.badgeTone ?? 'mango']}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-mango-100">
        <div className="flex items-center justify-between text-[10px] text-stone-500 px-1">
          <span className="flex items-center">
            <ShieldCheck className="w-3 h-3 text-leaf-600 mr-1" /> {user?.platformRole === 'SUPER_ADMIN' ? 'Super Admin' : user?.platformRole === 'SUPPORT' ? 'Support' : 'Merchant'}
          </span>
          <span className="font-mono">v3.4.2</span>
        </div>
        <div className="text-[10px] text-stone-400 mt-1.5 px-1">
          Powered by <span className="font-bold text-wave-500">First Wave</span>
        </div>
      </div>
    </aside>
  );
};
