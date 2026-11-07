import React from 'react';
import { CloudOff, Loader2, ServerCrash } from 'lucide-react';
import { useBilling } from '../context/BillingContext';
import { AppSnapshot } from '../types/snapshot';
import { SnapshotState } from '../lib/snapshot';

/** Shared building blocks for the feature screens (same look as BusinessStaff). */

export const PageHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; right?: React.ReactNode }> = ({ icon, title, subtitle, right }) => (
  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div>
      <div className="flex items-center space-x-2">{icon}<h2 className="text-xl font-black text-white">{title}</h2></div>
      <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
    </div>
    {right}
  </div>
);

export const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
    <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
      <div className="flex items-center space-x-2">{icon}<h3 className="font-extrabold text-sm text-white">{title}</h3></div>
      {right}
    </div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);

export const Stats: React.FC<{ items: [React.ReactNode, React.ReactNode, string?][] }> = ({ items }) => (
  <div className={`grid grid-cols-2 ${items.length >= 5 ? 'md:grid-cols-5' : items.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-3`}>
    {items.map(([label, value, hint], i) => (
      <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</p>
        <p className="text-xl font-black text-white mt-1">{value}</p>
        {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
    ))}
  </div>
);

const TONES = {
  green: 'bg-emerald-500/15 text-emerald-300', amber: 'bg-amber-500/15 text-amber-300', red: 'bg-rose-500/15 text-rose-300',
  blue: 'bg-indigo-500/15 text-indigo-300', grey: 'bg-slate-800 text-slate-400',
} as const;
export type Tone = keyof typeof TONES;
export const Pill: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'grey', children }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${TONES[tone]}`}>{children}</span>
);

export const Th: React.FC<{ children?: React.ReactNode; right?: boolean; first?: boolean }> = ({ children, right, first }) => (
  <th className={`p-3 ${first ? 'pl-5' : ''} ${right ? 'text-right pr-5' : ''}`}>{children}</th>
);
export const THead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]"><tr>{children}</tr></thead>
);
export const EmptyRow: React.FC<{ cols: number; text: string }> = ({ cols, text }) => (
  <tr><td colSpan={cols} className="p-6 text-center text-slate-400 text-xs">{text}</td></tr>
);

export const Tabs = <T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) => (
  <div className="flex flex-wrap gap-2">
    {tabs.map(([k, l]) => (
      <button key={k} onClick={() => onChange(k)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${value === k ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{l}</button>
    ))}
  </div>
);

/** Loading / error / "backend missing" handling for screens built on the synced app snapshot. */
export const SnapshotGate: React.FC<{ state: SnapshotState; children: (snap: AppSnapshot) => React.ReactNode }> = ({ state, children }) => {
  const { language } = useBilling();
  const hi = language === 'hi';
  if (state.loading) return <div className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin inline text-slate-500" /></div>;
  if (state.missingEndpoint) return (
    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl p-4 flex items-start space-x-2">
      <ServerCrash className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-bold">{hi ? 'बैकएंड में स्नैपशॉट API नहीं मिला' : 'Snapshot API not found on the backend'}</p>
        <p className="mt-1 text-amber-200/80">{hi
          ? 'यह स्क्रीन फ़ोन से सिंक हुआ डेटा पढ़ती है। बैकएंड में GET /api/admin/businesses/:id/snapshot जोड़ें (sync टेबल से snapshot लौटाए)।'
          : 'This screen reads the data synced from the phone. Add GET /api/admin/businesses/:id/snapshot to the backend (return the stored sync snapshot).'}</p>
      </div>
    </div>
  );
  if (state.error) return <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl p-3">{state.error}</div>;
  if (!state.snap) return (
    <div className="bg-slate-900 border border-slate-800 text-slate-400 text-xs rounded-xl p-4 flex items-center space-x-2">
      <CloudOff className="w-4 h-4" /><span>{hi ? 'इस बिजनेस ने अभी डेटा सिंक नहीं किया।' : "This business hasn't synced data yet."}</span>
    </div>
  );
  return <>{children(state.snap)}</>;
};

export const ReadOnlyNote: React.FC<{ updatedAt?: string | null }> = ({ updatedAt }) => {
  const { language } = useBilling();
  return (
    <p className="text-[10px] text-slate-500">
      {language === 'hi' ? 'फ़ोन से सिंक किया गया डेटा · सिर्फ़ देखने के लिए — मालिक ऐप में बदलते हैं' : 'Synced from the phone · read-only — owners change this in the app'}
      {updatedAt ? ` · ${new Date(updatedAt).toLocaleString('en-IN')}` : ''}
    </p>
  );
};
