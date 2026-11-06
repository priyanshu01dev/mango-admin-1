import React from 'react';
import { Lock } from 'lucide-react';
import { useBilling } from '../context/BillingContext';

/** Shown when the admin opens a screen they have no access to, or has no screens at all. */
export const NoAccess: React.FC<{ screen: string | null; onBack?: () => void }> = ({ screen, onBack }) => {
  const { language, admin } = useBilling();
  const hi = language === 'hi';
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center max-w-lg mx-auto mt-10 shadow-sm">
      <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto">
        <Lock className="w-5 h-5 text-slate-400" />
      </div>
      <h2 className="text-lg font-black text-white mt-4">{hi ? 'अनुमति नहीं है' : 'No access'}</h2>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
        {screen
          ? (hi ? `आपके पास इस स्क्रीन (${screen}) की अनुमति नहीं है।` : `You don't have access to this screen (${screen}).`)
          : (hi ? 'आपको अभी कोई स्क्रीन नहीं दी गई है।' : "You haven't been given any screens yet.")}
        {' '}
        {hi ? 'किसी सुपर एडमिन से Staff में अनुमति मांगें।' : 'Ask a super admin to give you access under Staff.'}
      </p>
      <p className="text-[10px] text-slate-500 mt-3 font-mono">{admin?.email}</p>
      {onBack && (
        <button onClick={onBack} className="mt-5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold">
          {hi ? 'वापस जाएँ' : 'Go to my screens'}
        </button>
      )}
    </div>
  );
};
