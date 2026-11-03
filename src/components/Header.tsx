import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { useAdmin } from '../context/AdminContext';
import { useDocuments } from '../context/DocumentsContext';
import { useAuth } from '../context/AuthContext';
import { TRANSLATIONS } from '../utils/formatters';
import {
  Building2,
  Globe2,
  PlusCircle,
  Bell,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  RefreshCw,
  LogOut,
  Plus
} from 'lucide-react';

interface HeaderProps {
  onOpenNewInvoice: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNewInvoice }) => {
  const {
    language,
    setLanguage,
    businesses,
    activeBusiness,
    setActiveBusinessId,
    invoices,
    products,
    quickNotification,
    resetAllToDefault
  } = useBilling();

  const { resetAdminData } = useAdmin();
  const { resetDocuments } = useDocuments();
  const { user, logout, selectBusiness, isPlatformAdmin } = useAuth();
  const displayName = user?.name || user?.email || user?.phone || (language === 'hi' ? 'एडमिन' : 'Admin');
  const hour = new Date().getHours();
  const greeting =
    language === 'hi'
      ? hour < 12 ? 'सुप्रभात' : hour < 17 ? 'नमस्ते' : 'शुभ संध्या'
      : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);

  const t = TRANSLATIONS[language];

  const lowStockCount = products.filter(p => p.currentStock <= p.minStockAlert).length;
  const overdueCount = invoices.filter(i => i.status === 'OVERDUE' || (i.status === 'UNPAID' && i.balanceDue > 0)).length;
  const totalNotifications = lowStockCount + overdueCount;

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-md border-b border-amber-500/20 px-4 lg:px-8 py-3 flex items-center justify-between no-print shadow-sm">
      {/* Left: Mango Logo & User Greeting (Matching mobile app screenshot style) */}
      <div className="flex items-center space-x-3">
        <div className="relative">
          <button
            onClick={() => setShowBizDropdown(!showBizDropdown)}
            className="flex items-center space-x-3 bg-transparent text-left transition-all group"
          >
            <img
              src="/logo.jpeg"
              alt="Logo"
              className="w-11 h-11 rounded-2xl object-cover shadow-lg border border-amber-500/30 shrink-0 group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="text-[11px] font-medium text-stone-500">
                {greeting}, {displayName}{isPlatformAdmin ? ' · Super Admin' : ''}
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-black text-ink max-w-[220px] truncate">
                  {activeBusiness.tradeName || activeBusiness.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-mango-600" />
              </div>
            </div>
          </button>

          {showBizDropdown && (
            <div className="absolute left-0 mt-2 w-72 bg-white border border-mango-100 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-mango-100">
                {language === 'hi' ? 'दुकान / बिजनेस बदलें' : 'Switch Store / Business'}
              </div>
              {businesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setActiveBusinessId(b.id);
                    setShowBizDropdown(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-center space-x-2.5 text-xs transition-colors my-1 ${
                    b.id === activeBusiness.id
                      ? 'bg-amber-500/15 text-mango-600 font-bold border border-amber-500/30'
                      : 'text-stone-700 hover:bg-mango-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0 text-stone-500" />
                  <div className="truncate">
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-[10px] text-stone-500 font-mono">{b.state} ({b.stateCode}) • {b.gstin}</div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  selectBusiness('');
                  setShowBizDropdown(false);
                }}
                className="w-full text-left p-2.5 rounded-xl flex items-center space-x-2.5 text-xs text-mango-700 hover:bg-mango-50 font-semibold"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>{language === 'hi' ? 'नया बिजनेस जोड़ें' : 'Add a new business'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Language, Notifications Bell, Grid Menu, New Bill */}
      <div className="flex items-center space-x-3">
        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-mango-50 text-stone-700 hover:text-ink border border-mango-100 text-xs font-semibold transition-all"
          title="Switch Language / भाषा बदलें"
        >
          <Globe2 className="w-3.5 h-3.5 text-mango-600" />
          <span>{language === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}</span>
        </button>

        {/* Notifications Bell with Orange Dot */}
        <div className="relative">
          <button
            onClick={() => setShowNotifyPanel(!showNotifyPanel)}
            className="p-2.5 rounded-xl bg-white hover:bg-mango-50 text-stone-700 hover:text-ink border border-mango-100 transition-colors relative"
            title="Alerts & Reminders"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          </button>

          {showNotifyPanel && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-mango-100 rounded-2xl shadow-2xl p-3 z-50">
              <div className="flex justify-between items-center pb-2 border-b border-mango-100 text-xs font-bold text-stone-800">
                <span>{language === 'hi' ? 'अलर्ट्स व सूचनाएं' : 'Alerts & Reminders'}</span>
                <span className="text-[10px] text-stone-500">{totalNotifications} Pending</span>
              </div>
              <div className="py-2 space-y-2 max-h-60 overflow-y-auto text-xs">
                {lowStockCount > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-mango-700">
                    <p className="font-semibold">⚠️ {lowStockCount} {language === 'hi' ? 'आइटम में कम स्टॉक है' : 'items are below minimum stock limit'}</p>
                    <p className="text-[10px] text-mango-600/80 mt-0.5">Check Inventory tab to reorder stock.</p>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-rose-700">
                    <p className="font-semibold">⏳ {overdueCount} {language === 'hi' ? 'इनवॉइस का भुगतान बाकी है' : 'invoices have pending balance'}</p>
                    <p className="text-[10px] text-rose-600/80 mt-0.5">Send WhatsApp reminder to customers.</p>
                  </div>
                )}
                {totalNotifications === 0 && (
                  <p className="text-center text-stone-500 py-3 text-xs">{language === 'hi' ? 'कोई नया अलर्ट नहीं है' : 'All clear! No urgent alerts.'}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Grid menu icon */}
        <button
          onClick={() => {
            resetAdminData();
            resetDocuments();
            resetAllToDefault();
          }}
          className="hidden sm:flex p-2.5 rounded-xl bg-white hover:bg-mango-50 text-stone-700 hover:text-ink border border-mango-100 transition-colors"
          title="Refresh data from the server"
          aria-label="Refresh data"
        >
          <RefreshCw className="w-4 h-4 text-mango-600" />
        </button>

        <button
          onClick={() => logout()}
          className="hidden sm:flex p-2.5 rounded-xl bg-white hover:bg-rose-50 text-stone-700 hover:text-rose-700 border border-mango-100 transition-colors"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>

        {/* Quick Action: New GST Invoice CTA */}
        <button
          onClick={onOpenNewInvoice}
          className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white font-black px-4 py-2 rounded-2xl text-xs shadow-lg shadow-amber-500/25 transition-all transform active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t.createNewInvoice}</span>
        </button>
      </div>
    </header>
  );
};
