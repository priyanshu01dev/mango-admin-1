import React, { useState } from 'react';
import { useAdmin } from '../../context/AdminContext';
import { ComplianceRules } from '../../types/admin';
import { Card, PageHeader, Badge, PrimaryButton, GhostButton, inputCls, Field, SegmentedTabs } from './ui';
import { Plug, ShieldCheck, RefreshCw } from 'lucide-react';

const STATUS_TONE = { CONNECTED: 'leaf', NOT_CONFIGURED: 'stone', ERROR: 'rose', MOCK: 'amber' } as const;


export const Integrations: React.FC = () => {
  const { integrations, compliance, updateCompliance, reload } = useAdmin();
  const [tab, setTab] = useState<'INTEGRATIONS' | 'COMPLIANCE'>('INTEGRATIONS');

  const categories = Array.from(new Set(integrations.map(i => i.category)));
  const notReady = integrations.filter(i => i.status !== 'CONNECTED');

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={Plug}
        title="Integrations & GST compliance"
        subtitle="Live status of the GSP, payments, messaging and database connections, plus the GST rule thresholds the server enforces"
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
          <div className="flex items-start gap-2 bg-wave-50 border border-blue-100 text-wave-700 rounded-xl p-3 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              API keys and secrets are set as environment variables on the server and are never sent to the browser.
              {notReady.length > 0 && <> <b>{notReady.length}</b> service{notReady.length > 1 ? 's are' : ' is'} not connected yet.</>}
            </span>
          </div>
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
                          <Badge tone={STATUS_TONE[i.status]}>{i.status === 'MOCK' ? 'DEV / MOCK' : i.status.replace('_', ' ')}</Badge>
                          <Badge tone={i.environment === 'PRODUCTION' ? 'mango' : 'wave'}>{i.environment}</Badge>
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-2">{i.note}</p>
                    </div>
                    <div className="text-[10px] text-stone-500">
                      Server env vars:{' '}
                      {i.envVars.map(v => (
                        <code key={v} className="bg-mango-50 border border-mango-100 rounded px-1 py-0.5 mr-1 font-mono text-stone-700">{v}</code>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          <GhostButton onClick={() => reload()}><RefreshCw className="w-3 h-3" /> Re-check status</GhostButton>
        </div>
      )}

      {tab === 'COMPLIANCE' && <ComplianceForm key={JSON.stringify(compliance)} rules={compliance} onSave={updateCompliance} />}
    </div>
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
