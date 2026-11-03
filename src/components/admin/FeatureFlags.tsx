import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { useBilling } from '../../context/BillingContext';
import { PLAN_COLORS } from '../../data/adminData';
import { FeatureFlag, PlanId, ClientPlatform } from '../../types/admin';
import { Card, PageHeader, Badge, SegmentedTabs, Toggle } from './ui';
import { Flag } from 'lucide-react';

const PLATFORMS: ClientPlatform[] = ['Android', 'iOS', 'Web'];

export const FeatureFlags: React.FC = () => {
  const { flags, updateFlag, plans } = useAdmin();
  const { showToast } = useBilling();
  const [phase, setPhase] = useState<'ALL' | 'P0' | 'P1' | 'P2'>('ALL');
  // slider drafts: commit once on release so the audit log isn't flooded
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const commitRollout = (f: FeatureFlag) => {
    const v = drafts[f.key];
    if (v === undefined) return;
    setDrafts(d => { const n = { ...d }; delete n[f.key]; return n; });
    if (v !== f.rollout) save({ ...f, rollout: v }, `${f.name}: rollout ${v}%`);
  };

  const shown = flags.filter(f => phase === 'ALL' || f.phase === phase);

  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const save = (f: FeatureFlag, msg?: string) => {
    updateFlag(f);
    if (msg) showToast(msg);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={Flag}
        title="Feature flags"
        subtitle="Roll features out gradually by plan, platform and percentage, without shipping a new app build (P0 = MVP, P1 = parity, P2 = differentiation)"
        actions={
          <SegmentedTabs
            value={phase}
            onChange={setPhase}
            options={[
              { id: 'ALL', label: 'All', count: flags.length },
              { id: 'P0', label: 'P0', count: flags.filter(f => f.phase === 'P0').length },
              { id: 'P1', label: 'P1', count: flags.filter(f => f.phase === 'P1').length },
              { id: 'P2', label: 'P2', count: flags.filter(f => f.phase === 'P2').length }
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {shown.map(f => (
          <Card key={f.key} className={`p-4 space-y-3 ${f.enabled ? '' : 'bg-stone-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-sm text-ink">{f.name}</h3>
                  <Badge tone={f.phase === 'P0' ? 'leaf' : f.phase === 'P1' ? 'wave' : 'violet'}>{f.phase}</Badge>
                  <code className="text-[10px] text-stone-500 bg-mango-50 px-1.5 py-0.5 rounded">{f.key}</code>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">{f.description}</p>
              </div>
              <Toggle checked={f.enabled} onChange={v => save({ ...f, enabled: v }, `${f.name} ${v ? 'enabled' : 'disabled'}`)} label={f.name} />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-semibold text-stone-600">Rollout</span>
                <span className="font-mono font-bold text-ink">{drafts[f.key] ?? f.rollout}% of eligible merchants</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={drafts[f.key] ?? f.rollout}
                disabled={!f.enabled}
                onChange={e => setDrafts(d => ({ ...d, [f.key]: Number(e.target.value) }))}
                onPointerUp={() => commitRollout(f)}
                onKeyUp={() => commitRollout(f)}
                onBlur={() => commitRollout(f)}
                className="w-full accent-mango-500 disabled:opacity-40"
                aria-label={`${f.name} rollout percentage`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-stone-500 font-semibold mr-1">Plans</span>
              {plans.map(p => {
                const on = f.plans.includes(p.id as PlanId);
                return (
                  <button
                    key={p.id}
                    onClick={() => save({ ...f, plans: toggleIn(f.plans, p.id) })}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold ${on ? 'bg-white border-mango-300 text-ink' : 'bg-transparent border-dashed border-stone-300 text-stone-400'}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: on ? PLAN_COLORS[p.id] : '#d6d3d1' }} />
                    {p.name}
                  </button>
                );
              })}
              <span className="text-stone-500 font-semibold ml-3 mr-1">Apps</span>
              {PLATFORMS.map(pl => {
                const on = f.platforms.includes(pl);
                return (
                  <button
                    key={pl}
                    onClick={() => save({ ...f, platforms: toggleIn(f.platforms, pl) })}
                    className={`px-2 py-1 rounded-lg border font-bold ${on ? 'bg-white border-mango-300 text-ink' : 'border-dashed border-stone-300 text-stone-400'}`}
                  >
                    {pl}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-stone-400">Last changed {f.updatedAt}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};
