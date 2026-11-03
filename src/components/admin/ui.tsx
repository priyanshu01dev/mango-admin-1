import React from 'react';

/** Shared building blocks for the Mango Invoice super-admin screens. */

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-white border border-mango-100 rounded-2xl shadow-sm shadow-mango-900/5 ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{
  icon: React.FC<{ className?: string }>;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, actions }) => (
  <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="flex items-start space-x-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-mango-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-mango-500/25 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-xl font-black text-ink">{title}</h2>
        <p className="text-stone-500 text-xs mt-0.5">{subtitle}</p>
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </Card>
);

export const StatTile: React.FC<{
  label: string;
  value: string;
  sub?: string;
  trend?: { value: string; positive: boolean };
  icon?: React.FC<{ className?: string }>;
}> = ({ label, value, sub, trend, icon: Icon }) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">{label}</span>
      {Icon && <Icon className="w-4 h-4 text-mango-500" />}
    </div>
    <div className="text-2xl font-black text-ink mt-1.5 font-mono tracking-tight">{value}</div>
    <div className="flex items-center gap-2 mt-1 text-[11px]">
      {trend && (
        <span className={`font-bold ${trend.positive ? 'text-leaf-600' : 'text-rose-600'}`}>
          {trend.positive ? '▲' : '▼'} {trend.value}
        </span>
      )}
      {sub && <span className="text-stone-500">{sub}</span>}
    </div>
  </Card>
);

type Tone = 'mango' | 'leaf' | 'wave' | 'rose' | 'stone' | 'violet' | 'amber';
const TONES: Record<Tone, string> = {
  mango: 'bg-mango-50 text-mango-700 border-mango-200',
  leaf: 'bg-leaf-50 text-leaf-700 border-leaf-100',
  wave: 'bg-wave-50 text-wave-600 border-blue-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  stone: 'bg-stone-100 text-stone-600 border-stone-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200'
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string }> = ({ tone = 'stone', children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${TONES[tone]} ${className}`}>
    {children}
  </span>
);

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap bg-mango-50/70 p-1 rounded-xl border border-mango-100 gap-0.5">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            value === o.id ? 'bg-mango-500 text-white shadow-sm' : 'text-stone-500 hover:text-ink'
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={`ml-1.5 text-[10px] ${value === o.id ? 'text-white/80' : 'text-stone-400'}`}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center gap-1.5 bg-mango-500 hover:bg-mango-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-mango-500/25 transition-all ${className}`}
  >
    {children}
  </button>
);

export const GhostButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...rest }) => (
  <button
    {...rest}
    className={`inline-flex items-center gap-1.5 bg-white hover:bg-mango-50 text-stone-700 border border-mango-200/70 font-semibold px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);

export const inputCls =
  'w-full bg-white border border-mango-200/70 rounded-lg px-2.5 py-2 text-xs text-ink placeholder-stone-400';

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-stone-500 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-stone-400 mt-0.5">{hint}</span>}
  </label>
);

/** Usage meter against a plan limit. limit null = unlimited, 0 = not in plan. */
export const UsageBar: React.FC<{ label: string; used: number; limit: number | null }> = ({ label, used, limit }) => {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const over = limit !== null && limit > 0 && used > limit;
  const near = !over && pct >= 80;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="font-semibold text-stone-700">{label}</span>
        <span className={`font-mono font-bold ${over ? 'text-rose-600' : near ? 'text-mango-700' : 'text-stone-500'}`}>
          {used.toLocaleString('en-IN')} / {limit === null ? '∞' : limit === 0 ? 'not in plan' : limit.toLocaleString('en-IN')}
          {over && ' · over limit'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-mango-50 overflow-hidden">
        <div
          className={`h-full rounded-full ${over ? 'bg-rose-500' : near ? 'bg-mango-500' : 'bg-leaf-500'}`}
          style={{ width: limit === null ? '100%' : `${limit === 0 ? 0 : Math.max(2, pct)}%`, opacity: limit === null ? 0.25 : 1 }}
        />
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center text-stone-400 text-xs py-10">{text}</div>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-leaf-500' : 'bg-stone-300'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
  </button>
);

export const Drawer: React.FC<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: string }> = ({
  open,
  onClose,
  title,
  children,
  width = 'max-w-xl'
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40" onClick={onClose}>
      <div className={`w-full ${width} h-full bg-cream shadow-2xl overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-mango-100 px-5 py-3 flex items-center justify-between z-10">
          <h3 className="font-extrabold text-sm text-ink">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-ink text-lg leading-none px-2" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const fmtNum = (n: number) => n.toLocaleString('en-IN');
export const fmtCompactINR = (n: number) => {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};
