import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { TRANSLATIONS } from '../utils/formatters';
import {
  Building2,
  Globe2,
  PlusCircle,
  Bell,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  Sparkles
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
    resetAllToDefault,
    admin,
    logout,
    loading,
    hasBusinessAccess
  } = useBilling();
  const [bizSearch, setBizSearch] = useState('');

  const [showBizDropdown, setShowBizDropdown] = useState(false);
  const [showNotifyPanel, setShowNotifyPanel] = useState(false);

  const t = TRANSLATIONS[language];

  const lowStockCount = products.filter(p => (!p.isService && p.currentStock < p.minStockAlert)).length;
  const overdueCount = invoices.filter(i => i.status === 'OVERDUE' || (i.status === 'UNPAID' && i.balanceDue > 0)).length;
  const totalNotifications = lowStockCount + overdueCount;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3.5 flex items-center justify-between no-print shadow-sm">
      {/* Left: Active Business Switcher (only for admins with a business screen) */}
      <div className={`flex items-center space-x-3 ${hasBusinessAccess ? '' : 'invisible'}`}>
        <div className="relative">
          <button
            onClick={() => setShowBizDropdown(!showBizDropdown)}
            className="flex items-center space-x-2.5 bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700/60 text-left transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-sm shadow-md">
              {(activeBusiness.name || '?').slice(0, 1)}
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white max-w-[190px] truncate">
                  {activeBusiness.tradeName || activeBusiness.name || (language === 'hi' ? 'बिजनेस चुनें' : 'Select business')}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-[10px] text-emerald-400 font-mono font-medium">
                GSTIN: {activeBusiness.gstin}
              </p>
            </div>
          </button>

          {showBizDropdown && (
            <div className="absolute left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
                {language === 'hi' ? 'दुकान / बिजनेस बदलें' : 'Switch Store / Business'}
              </div>
              <div className="p-2 border-b border-slate-700/50">
                <input
                  autoFocus
                  value={bizSearch}
                  onChange={e => setBizSearch(e.target.value)}
                  placeholder={language === 'hi' ? 'नाम, GSTIN या शहर खोजें…' : 'Search name, GSTIN or city…'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500"
                />
              </div>
              <div className="max-h-80 overflow-y-auto">
              {businesses.filter(b => !bizSearch || `${b.name} ${b.gstin} ${b.city} ${b.state} ${b.ownerPhone ?? ''}`.toLowerCase().includes(bizSearch.toLowerCase())).map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setActiveBusinessId(b.id);
                    setShowBizDropdown(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg flex items-center space-x-2.5 text-xs transition-colors ${
                    b.id === activeBusiness.id
                      ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0 text-slate-400" />
                  <div className="truncate">
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{b.city || b.state || '—'} • {b.gstin} • {b.activePlan}</div>
                  </div>
                </button>
              ))}
              </div>
              <div className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-700/50">{businesses.length} {language === 'hi' ? 'बिजनेस ऐप पर' : 'businesses on the app'}</div>
            </div>
          )}
        </div>

        {/* State Code Badge */}
        <div className="hidden md:flex items-center space-x-1.5 bg-slate-800/40 border border-slate-700/50 px-2.5 py-1.5 rounded-lg text-xs">
          <span className="text-slate-400 text-[11px]">{language === 'hi' ? 'राज्य:' : 'State:'}</span>
          <span className="font-semibold text-slate-200">{activeBusiness.state}</span>
          <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
            Code: {activeBusiness.stateCode}
          </span>
        </div>
      </div>

      {/* Toast Alert Banner if active */}
      {quickNotification && (
        <div className="hidden lg:flex items-center space-x-2 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-full text-xs font-medium animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{quickNotification}</span>
        </div>
      )}

      {/* Right Controls: Language switch, notifications, Reset, New Bill button */}
      <div className="flex items-center space-x-2.5">
        {/* Language Switcher */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/70 text-xs font-semibold transition-all"
          title="Switch Language / भाषा बदलें"
        >
          <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>{language === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}</span>
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifyPanel(!showNotifyPanel)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/70 transition-colors relative"
            title="Alerts & Reminders"
          >
            <Bell className="w-4 h-4" />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center">
                {totalNotifications}
              </span>
            )}
          </button>

          {showNotifyPanel && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-3 z-50">
              <div className="flex justify-between items-center pb-2 border-b border-slate-700 text-xs font-bold text-slate-200">
                <span>{language === 'hi' ? 'अलर्ट्स व सूचनाएं' : 'Alerts & Reminders'}</span>
                <span className="text-[10px] text-slate-400">{totalNotifications} Pending</span>
              </div>
              <div className="py-2 space-y-2 max-h-60 overflow-y-auto text-xs">
                {lowStockCount > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-amber-300">
                    <p className="font-semibold">⚠️ {lowStockCount} {language === 'hi' ? 'आइटम में कम स्टॉक है' : 'items are below minimum stock limit'}</p>
                    <p className="text-[10px] text-amber-400/80 mt-0.5">Check Inventory tab to reorder stock.</p>
                  </div>
                )}
                {overdueCount > 0 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg text-rose-300">
                    <p className="font-semibold">⏳ {overdueCount} {language === 'hi' ? 'इनवॉइस का भुगतान बाकी है' : 'invoices have pending balance'}</p>
                    <p className="text-[10px] text-rose-400/80 mt-0.5">Send WhatsApp reminder to customers.</p>
                  </div>
                )}
                {totalNotifications === 0 && (
                  <p className="text-center text-slate-400 py-3 text-xs">{language === 'hi' ? 'कोई नया अलर्ट नहीं है' : 'All clear! No urgent alerts.'}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reset Demo Data Button */}
        <button
          onClick={() => resetAllToDefault()}
          className="hidden sm:flex items-center space-x-1 p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/70 transition-colors text-xs"
          title={language === 'hi' ? 'ताज़ा डेटा लाएं' : 'Refresh data from server'}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Quick Action: New GST Invoice CTA */}
        {null}

        {/* Super Admin User Profile indicator */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
            {(admin?.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div className="text-left text-xs leading-none">
            <span className="font-bold text-slate-200">{admin?.name}</span>
            <span className="block text-[10px] text-emerald-400 mt-1 flex items-center">
              <ShieldCheck className="w-2.5 h-2.5 mr-0.5 inline" /> {admin?.isSuperAdmin ? 'super admin' : 'admin'}
            </span>
          </div>
          <button onClick={logout} className="ml-1 text-[10px] text-slate-400 hover:text-rose-400 underline">
            {language === 'hi' ? 'लॉग आउट' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  );
};
