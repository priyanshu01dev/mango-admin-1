import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { Lock, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, language } = useBilling();
  const hi = language === 'hi';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email.trim(), password); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl space-y-5">
        <div className="flex items-center space-x-3">
          <img src="/mango-mark.png" alt="" className="w-11 h-11 rounded-xl" />
          <div>
            <h1 className="text-lg font-black text-white">Mango <span className="text-orange-400">Invoice</span></h1>
            <p className="text-[11px] text-slate-400">{hi ? 'एडमिन कंसोल' : 'Admin console'}</p>
          </div>
        </div>
        {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg p-2.5">{error}</div>}
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Email</label>
          <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">{hi ? 'पासवर्ड' : 'Password'}</label>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" />
        </div>
        <button type="submit" disabled={busy}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          <span>{hi ? 'साइन इन करें' : 'Sign in'}</span>
        </button>
        <p className="text-[10px] text-slate-500 text-center">{hi ? 'हर एक्शन ऑडिट लॉग में दर्ज होता है' : 'Every action is recorded in the audit log'}</p>
      </form>
    </div>
  );
};
