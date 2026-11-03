import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { errMsg } from '../../api/client';
import { inputCls, PrimaryButton, SegmentedTabs } from '../admin/ui';
import { Smartphone, Mail, ShieldCheck } from 'lucide-react';
import { LegalLinks } from '../legal/LegalPages';

export const LoginScreen: React.FC = () => {
  const { loginWithEmail, requestOtp, verifyOtp } = useAuth();
  const [mode, setMode] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-mango-500 to-orange-600" />
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/logo.jpeg" alt="Mango Invoice" className="w-24 h-24 rounded-3xl mx-auto shadow-lg shadow-mango-500/20 border border-mango-100 object-cover" />
          <h1 className="text-2xl font-black text-ink mt-4">
            Mango <span className="text-mango-600">Invoice</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">GST billing · Admin panel</p>
        </div>

        <div className="bg-white border border-mango-100 rounded-2xl shadow-sm p-5 space-y-4">
          <SegmentedTabs
            value={mode}
            onChange={m => { setMode(m); setError(''); }}
            options={[
              { id: 'EMAIL', label: 'Email (admin)' },
              { id: 'OTP', label: 'Mobile OTP' }
            ]}
          />

          {mode === 'EMAIL' ? (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => loginWithEmail(email, password)); }}>
              <label className="block text-xs">
                <span className="text-stone-500 font-semibold">Email</span>
                <div className="relative mt-1">
                  <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className={`${inputCls} pl-8`} />
                </div>
              </label>
              <label className="block text-xs">
                <span className="text-stone-500 font-semibold">Password</span>
                <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
              <PrimaryButton type="submit" disabled={busy} className="w-full justify-center py-2.5">{busy ? 'Signing in…' : 'Sign in'}</PrimaryButton>
            </form>
          ) : !otpSent ? (
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault();
                run(async () => {
                  const r = await requestOtp(phone);
                  setDevCode(r.devCode);
                  setOtpSent(true);
                });
              }}
            >
              <label className="block text-xs">
                <span className="text-stone-500 font-semibold">Mobile number</span>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-semibold">+91</span>
                  <input inputMode="numeric" required value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d ]/g, ''))} className={`${inputCls} pl-10`} placeholder="98100 12345" />
                </div>
              </label>
              <PrimaryButton type="submit" disabled={busy} className="w-full justify-center py-2.5"><Smartphone className="w-3.5 h-3.5" /> {busy ? 'Sending…' : 'Send OTP'}</PrimaryButton>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); run(() => verifyOtp(phone, code, name)); }}>
              <div className="text-[11px] text-stone-600">
                OTP sent to <b>+91 {phone}</b>.{' '}
                <button type="button" className="text-mango-600 font-semibold" onClick={() => { setOtpSent(false); setCode(''); }}>Change</button>
              </div>
              {devCode && (
                <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2">
                  Development mode (no SMS provider): your OTP is <b className="font-mono">{devCode}</b>
                </div>
              )}
              <input inputMode="numeric" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={`${inputCls} text-center font-mono text-lg tracking-[0.5em]`} placeholder="••••••" autoFocus />
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Your name (first login only)" />
              <PrimaryButton type="submit" disabled={busy || code.length !== 6} className="w-full justify-center py-2.5">{busy ? 'Verifying…' : 'Verify & continue'}</PrimaryButton>
            </form>
          )}

          {error && <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</div>}
        </div>

        <p className="text-center text-[10px] text-stone-400 mt-4">By continuing you agree to the <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.</p>
        <div className="mt-2"><LegalLinks /></div>
        <p className="text-center text-[10px] text-stone-400 mt-2 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3 text-leaf-600" /> Powered by <span className="font-bold text-wave-500">First Wave</span>
        </p>
      </div>
    </div>
  );
};
