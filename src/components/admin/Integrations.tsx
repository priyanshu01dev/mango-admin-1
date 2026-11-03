import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { Integration, ComplianceRules } from '../../types/admin';
import { Card, PageHeader, Badge, PrimaryButton, GhostButton, inputCls, Field, Drawer, SegmentedTabs } from './ui';
import { Plug, ShieldCheck, Eye, EyeOff, RefreshCw, Settings2, AlertTriangle } from 'lucide-react';

const STATUS_TONE = { CONNECTED: 'leaf', NOT_CONFIGURED: 'stone', ERROR: 'rose' } as const;

const mask = (v: string) => (v.length <= 6 ? '••••••' : `${v.slice(0, 4)}••••••${v.slice(-2)}`);

export const Integrations: React.FC = () => {
  const { integrations, compliance, updateCompliance, testIntegration } = useAdmin();
  const [tab, setTab] = useState<'INTEGRATIONS' | 'COMPLIANCE'>('INTEGRATIONS');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editing = integrations.find(i => i.key === editingKey) ?? null;

  const categories = Array.from(new Set(integrations.map(i => i.category)));

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={Plug}
        title="Integrations & GST compliance"
        subtitle="GSP for e-invoice / e-way bill, GSTIN lookup, payment gateways, WhatsApp, SMS/OTP, backups, plus the GST rule thresholds the app enforces"
        actions={
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { id: 'INTEGRATIONS', label: 'Third-party services', count: integrations.length },
              { id: 'COMPLIANCE', label: 'Compliance guardrails' }
            ]}
          />
        }
      />

      {tab === 'INTEGRATIONS' && (
        <div className="space-y-6">
          {integrations.some(i => i.status === 'ERROR') && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                <b>{integrations.filter(i => i.status === 'ERROR').map(i => i.name).join(', ')}</b> needs attention. Merchants may not receive invoices or reminders.
              </span>
            </div>
          )}
          {categories.map(cat => (
            <div key={cat}>
              <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-2 px-1">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.filter(i => i.category === cat).map(i => (
                  <Card key={i.key} className="p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-sm text-ink">{i.name}</h4>
                          <div className="text-[11px] text-stone-500">{i.provider}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={STATUS_TONE[i.status]}>{i.status.replace('_', ' ')}</Badge>
                          <Badge tone={i.environment === 'PRODUCTION' ? 'mango' : 'wave'}>{i.environment}</Badge>
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-2">{i.note}</p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500">
                      <span>Checked {i.lastChecked}</span>
                      <div className="flex gap-1.5">
                        <GhostButton onClick={() => testIntegration(i.key)}><RefreshCw className="w-3 h-3" /> Test</GhostButton>
                        <GhostButton onClick={() => setEditingKey(i.key)}><Settings2 className="w-3 h-3" /> Configure</GhostButton>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'COMPLIANCE' && <ComplianceForm rules={compliance} onSave={updateCompliance} />}

      <Drawer open={!!editing} onClose={() => setEditingKey(null)} title={editing ? `Configure · ${editing.name}` : ''}>
        {editing && <IntegrationForm key={editing.key} integration={editing} onDone={() => setEditingKey(null)} />}
      </Drawer>
    </div>
  );
};

const IntegrationForm: React.FC<{ integration: Integration; onDone: () => void }> = ({ integration, onDone }) => {
  const { updateIntegration } = useAdmin();
  const [draft, setDraft] = useState<Integration>(integration);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  return (
    <form
      className="space-y-4 text-xs"
      onSubmit={e => {
        e.preventDefault();
        updateIntegration(draft);
        onDone();
      }}
    >
      <Card className="p-4 grid grid-cols-2 gap-3">
        <Field label="Provider">
          <select className={inputCls} value={draft.provider} onChange={e => setDraft({ ...draft, provider: e.target.value })}>
            {draft.providerOptions.map(p => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Environment">
          <select className={inputCls} value={draft.environment} onChange={e => setDraft({ ...draft, environment: e.target.value as Integration['environment'] })}>
            <option value="SANDBOX">Sandbox</option>
            <option value="PRODUCTION">Production</option>
          </select>
        </Field>
      </Card>
      <Card className="p-4 space-y-3">
        {draft.fields.map((f, idx) => (
          <Field key={f.key} label={f.label}>
            <div className="flex gap-1.5">
              <input
                className={`${inputCls} font-mono`}
                type={f.secret && !reveal[f.key] ? 'password' : 'text'}
                value={f.value}
                onChange={e => {
                  const fields = [...draft.fields];
                  fields[idx] = { ...f, value: e.target.value };
                  setDraft({ ...draft, fields });
                }}
                autoComplete="off"
              />
              {f.secret && (
                <button type="button" onClick={() => setReveal({ ...reveal, [f.key]: !reveal[f.key] })} className="px-2 rounded-lg border border-mango-200 text-stone-500 hover:text-ink" aria-label="Show / hide">
                  {reveal[f.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            {f.secret && !reveal[f.key] && <span className="text-[10px] text-stone-400">Stored: {mask(f.value)}</span>}
          </Field>
        ))}
        <p className="text-[10px] text-stone-500">
          Demo only: in production, secrets must live in the backend secret store (e.g. AWS Secrets Manager), never in the browser.
        </p>
      </Card>
      {draft.environment === 'PRODUCTION' && integration.environment === 'SANDBOX' && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Switching to production: complete GSP certification on the NIC sandbox first.
        </div>
      )}
      <PrimaryButton type="submit">Save configuration</PrimaryButton>
    </form>
  );
};

const RULE_FIELDS: { key: keyof ComplianceRules; label: string; unit: string; hint: string }[] = [
  { key: 'eInvoiceAatoThresholdCr', label: 'e-Invoice mandatory above AATO', unit: '₹ Cr', hint: 'B2B invoices, credit/debit notes when AATO exceeds this in any FY since 2017-18' },
  { key: 'irpReportingWindowDays', label: 'IRP reporting window (AATO ≥ ₹10 Cr)', unit: 'days', hint: 'Portal rejects late uploads; app shows "days left to report"' },
  { key: 'warnDaysBeforeIrpDeadline', label: 'Warn merchant before IRP deadline', unit: 'days', hint: 'Dashboard + push alert' },
  { key: 'irnCancelWindowHours', label: 'IRN cancellation window', unit: 'hours', hint: 'Cancel button disabled after this' },
  { key: 'eWayBillThreshold', label: 'e-Way bill required above consignment value', unit: '₹', hint: 'Goods movement' },
  { key: 'eWayBillMaxDocAgeDays', label: 'e-Way bill allowed within document age', unit: 'days', hint: 'Reported change: verify against latest GSTN advisory' },
  { key: 'b2cLargeThreshold', label: 'Unregistered buyer full address above', unit: '₹', hint: 'Name, address, delivery address, state name & code' },
  { key: 'hsnDigitsBelow5Cr', label: 'HSN digits (B2B, AATO ≤ ₹5 Cr)', unit: 'digits', hint: 'Optional for B2C' },
  { key: 'hsnDigitsAbove5Cr', label: 'HSN digits (AATO > ₹5 Cr)', unit: 'digits', hint: 'All invoices' },
  { key: 'invoiceNumberMaxLength', label: 'Invoice number max length (Rule 46)', unit: 'chars', hint: 'Letters, digits, "-" and "/" only; unique per FY' }
];

const ComplianceForm: React.FC<{ rules: ComplianceRules; onSave: (r: ComplianceRules) => void }> = ({ rules, onSave }) => {
  const [draft, setDraft] = useState<ComplianceRules>(rules);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules);
  return (
    <Card className="p-5 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-leaf-600" />
          <h3 className="font-extrabold text-sm text-ink">GST rule thresholds pushed to every app (2026)</h3>
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={() => setDraft(rules)} disabled={!dirty}>Discard</GhostButton>
          <PrimaryButton onClick={() => onSave(draft)} disabled={!dirty}>Publish rules</PrimaryButton>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RULE_FIELDS.map(f => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className={`${inputCls} font-mono`}
                value={draft[f.key]}
                onChange={e => setDraft({ ...draft, [f.key]: Math.max(0, Number(e.target.value)) })}
              />
              <span className="text-[11px] text-stone-500 w-12 shrink-0">{f.unit}</span>
            </div>
          </Field>
        ))}
      </div>
    </Card>
  );
};
