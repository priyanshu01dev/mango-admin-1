import React, { useCallback, useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { useBilling } from '../context/BillingContext';
import { get, post, put, patch, errMsg } from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Card, Badge, SegmentedTabs, PrimaryButton, GhostButton, Field, inputCls, Drawer, EmptyState } from './admin/ui';
import { Inventory } from './Inventory';
import { ArrowRightLeft, Plus, Printer, Tags } from 'lucide-react';

type Tab = 'ITEMS' | 'GODOWNS' | 'BATCHES' | 'PRICES' | 'LABELS';

/** Inventory with the P1 extras (spec §8.3): godowns, batches/expiry, price lists, barcode labels. */
export const InventoryHub: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ITEMS');
  return (
    <div className="space-y-4">
      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { id: 'ITEMS', label: 'Items & stock' },
          { id: 'GODOWNS', label: 'Godowns' },
          { id: 'BATCHES', label: 'Batches & expiry' },
          { id: 'PRICES', label: 'Price lists' },
          { id: 'LABELS', label: 'Barcode labels' }
        ]}
      />
      {tab === 'ITEMS' && <Inventory />}
      {tab === 'GODOWNS' && <Godowns />}
      {tab === 'BATCHES' && <Batches />}
      {tab === 'PRICES' && <PriceLists />}
      {tab === 'LABELS' && <BarcodeLabels />}
    </div>
  );
};

// ---------------- godowns ----------------

interface GodownRow { _id: string; name: string; address: string; isDefault: boolean; items: number; units: number; value: number }

const Godowns: React.FC = () => {
  const { products, showToast, reload, role } = useBilling();
  const [rows, setRows] = useState<GodownRow[]>([]);
  const [stockOf, setStockOf] = useState<{ godown: GodownRow; items: { product: { name: string; unit: string }; quantity: number }[] } | null>(null);
  const [name, setName] = useState('');
  const [transfer, setTransfer] = useState({ productId: '', fromGodownId: '', toGodownId: '', quantity: 1 });
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const g = await get<GodownRow[]>('/api/godowns');
      setRows(g);
      setTransfer(t => ({ ...t, fromGodownId: t.fromGodownId || g[0]?._id || '', toGodownId: t.toGodownId || g[1]?._id || '', productId: t.productId || products.find(p => !p.trackBatches)?.id || '' }));
    } catch (e) {
      showToast(errMsg(e));
    }
  }, [showToast, products]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      showToast(ok);
      await load();
      await reload();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 lg:col-span-2 space-y-3">
        <table className="w-full text-left text-xs text-stone-700">
          <thead className="bg-mango-50/60 text-stone-500 uppercase font-semibold text-[10px] tracking-wider">
            <tr><th className="p-3">Godown</th><th className="p-3 text-right">Items</th><th className="p-3 text-right">Units</th><th className="p-3 text-right">Stock value (cost)</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-mango-100">
            {rows.map(g => (
              <tr key={g._id}>
                <td className="p-3"><div className="font-bold text-ink">{g.name} {g.isDefault && <Badge tone="mango">default</Badge>}</div><div className="text-[10px] text-stone-500">{g.address}</div></td>
                <td className="p-3 text-right font-mono">{g.items}</td>
                <td className="p-3 text-right font-mono">{g.units}</td>
                <td className="p-3 text-right font-mono font-bold text-ink">{formatINR(g.value)}</td>
                <td className="p-3 text-right"><GhostButton onClick={async () => { try { setStockOf(await get(`/api/godowns/${g._id}/stock`)); } catch (e) { showToast(errMsg(e)); } }}>View stock</GhostButton></td>
              </tr>
            ))}
          </tbody>
        </table>
        {canManage && (
          <form onSubmit={e => { e.preventDefault(); act(() => post('/api/godowns', { name }), `Godown ${name} added`).then(() => setName('')); }} className="flex gap-2">
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="New godown / branch name" required minLength={2} />
            <PrimaryButton type="submit"><Plus className="w-3.5 h-3.5" /> Add godown</PrimaryButton>
          </form>
        )}
      </Card>

      {canManage && (
        <Card className="p-4 space-y-3 text-xs h-fit">
          <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-mango-500" /> Stock transfer</h3>
          <Field label="Item">
            <select className={inputCls} value={transfer.productId} onChange={e => setTransfer({ ...transfer, productId: e.target.value })}>
              {products.filter(p => p.status === 'ACTIVE').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="From">
            <select className={inputCls} value={transfer.fromGodownId} onChange={e => setTransfer({ ...transfer, fromGodownId: e.target.value })}>
              {rows.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="To">
            <select className={inputCls} value={transfer.toGodownId} onChange={e => setTransfer({ ...transfer, toGodownId: e.target.value })}>
              {rows.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Quantity"><input type="number" min={1} className={inputCls} value={transfer.quantity} onChange={e => setTransfer({ ...transfer, quantity: Number(e.target.value) })} /></Field>
          <PrimaryButton disabled={rows.length < 2 || transfer.fromGodownId === transfer.toGodownId} onClick={() => act(() => post('/api/godowns/transfer', transfer), 'Stock transferred')}>
            <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
          </PrimaryButton>
          {rows.length < 2 && <p className="text-[10px] text-stone-500">Add a second godown to transfer stock.</p>}
        </Card>
      )}

      <Drawer open={!!stockOf} onClose={() => setStockOf(null)} title={`Stock · ${stockOf?.godown.name ?? ''}`}>
        {stockOf && (
          <table className="w-full text-xs">
            <tbody className="divide-y divide-mango-100">
              {stockOf.items.map((i, k) => <tr key={k}><td className="p-2 text-ink font-semibold">{i.product?.name}</td><td className="p-2 text-right font-mono">{i.quantity} {i.product?.unit}</td></tr>)}
            </tbody>
          </table>
        )}
        {stockOf && stockOf.items.length === 0 && <EmptyState text="No stock here." />}
      </Drawer>
    </div>
  );
};

// ---------------- batches & expiry ----------------

interface BatchRow { _id: string; batchNo: string; expiryDate: string; quantity: number; expired?: boolean; productId: { name: string; unit: string; purchasePrice?: number } }

const Batches: React.FC = () => {
  const { showToast } = useBilling();
  const [days, setDays] = useState(60);
  const [expiring, setExpiring] = useState<BatchRow[]>([]);
  const [all, setAll] = useState<BatchRow[]>([]);
  useEffect(() => {
    Promise.all([get<{ rows: BatchRow[] }>(`/api/batches/expiring?days=${days}`), get<BatchRow[]>('/api/batches')])
      .then(([e, a]) => { setExpiring(e.rows); setAll(a); })
      .catch(e => showToast(errMsg(e)));
  }, [days, showToast]);
  const atRisk = expiring.reduce((a, b) => a + b.quantity * (b.productId?.purchasePrice ?? 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-ink">Expiring within
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="ml-2 border border-mango-200 rounded px-1 text-xs">
              {[30, 60, 90, 180].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </h3>
          <span className="text-[11px] text-stone-600">stock at risk <b className="font-mono text-rose-600">{formatINR(atRisk)}</b></span>
        </div>
        <BatchTable rows={expiring} />
      </Card>
      <Card className="p-4 space-y-3">
        <h3 className="font-extrabold text-sm text-ink">All batches in stock</h3>
        <BatchTable rows={all} />
      </Card>
    </div>
  );
};

const BatchTable: React.FC<{ rows: BatchRow[] }> = ({ rows }) => {
  const today = new Date().toISOString().slice(0, 10);
  return rows.length === 0 ? (
    <EmptyState text="No batches." />
  ) : (
    <table className="w-full text-left text-xs text-stone-700">
      <thead className="text-[10px] uppercase text-stone-500"><tr><th className="p-2">Item</th><th className="p-2">Batch</th><th className="p-2">Expiry</th><th className="p-2 text-right">Qty</th></tr></thead>
      <tbody className="divide-y divide-mango-100">
        {rows.map(b => (
          <tr key={b._id}>
            <td className="p-2 font-semibold text-ink">{b.productId?.name}</td>
            <td className="p-2 font-mono">{b.batchNo}</td>
            <td className="p-2">{b.expiryDate ? <Badge tone={b.expiryDate < today ? 'rose' : 'amber'}>{b.expiryDate < today ? 'expired ' : ''}{formatDate(b.expiryDate)}</Badge> : '—'}</td>
            <td className="p-2 text-right font-mono">{b.quantity} {b.productId?.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ---------------- price lists ----------------

interface PriceListRow { _id: string; name: string; active: boolean; items: { productId: string; price: number }[] }

const PriceLists: React.FC = () => {
  const { products, parties, showToast, reload, role } = useBilling();
  const [lists, setLists] = useState<PriceListRow[]>([]);
  const [editing, setEditing] = useState<PriceListRow | null>(null);
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const load = useCallback(() => get<PriceListRow[]>('/api/price-lists').then(setLists).catch(e => showToast(errMsg(e))), [showToast]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (pl: PriceListRow) => {
    try {
      const body = { name: pl.name, active: pl.active, items: pl.items.filter(i => i.price > 0) };
      if (pl._id) await put(`/api/price-lists/${pl._id}`, body);
      else await post('/api/price-lists', body);
      showToast(`Price list ${pl.name} saved`);
      setEditing(null);
      load();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  const assign = async (partyId: string, priceListId: string) => {
    const party = parties.find(p => p.id === partyId);
    if (!party) return;
    try {
      await patch(`/api/parties/${partyId}`, { priceListId: priceListId || null });
      showToast(`${party.name}: ${priceListId ? lists.find(l => l._id === priceListId)?.name : 'standard prices'}`);
      reload();
    } catch (e) {
      showToast(errMsg(e));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-ink flex items-center gap-2"><Tags className="w-4 h-4 text-mango-500" /> Price lists</h3>
          {canManage && <PrimaryButton onClick={() => setEditing({ _id: '', name: '', active: true, items: [] })}><Plus className="w-3.5 h-3.5" /> New list</PrimaryButton>}
        </div>
        {lists.map(l => (
          <div key={l._id} className="flex items-center justify-between border border-mango-100 rounded-xl p-3 text-xs">
            <div><div className="font-bold text-ink">{l.name}</div><div className="text-[10px] text-stone-500">{l.items.length} item prices · {parties.filter(p => p.priceListId === l._id).length} parties</div></div>
            {canManage && <GhostButton onClick={() => setEditing(l)}>Edit</GhostButton>}
          </div>
        ))}
        {lists.length === 0 && <EmptyState text="No price lists. Create Wholesale / Dealer / Retail lists." />}
      </Card>

      <Card className="p-4 space-y-2 text-xs">
        <h3 className="font-extrabold text-sm text-ink">Assign to customers</h3>
        {parties.filter(p => p.type === 'CUSTOMER').map(p => (
          <div key={p.id} className="flex items-center justify-between gap-2">
            <span className="text-ink font-semibold truncate">{p.name}</span>
            <select disabled={!canManage} className={`${inputCls} w-44`} value={p.priceListId ?? ''} onChange={e => assign(p.id, e.target.value)}>
              <option value="">Standard prices</option>
              {lists.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </div>
        ))}
      </Card>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? `Edit ${editing.name}` : 'New price list'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); save(editing); }} className="space-y-3 text-xs">
            <Field label="Name"><input className={inputCls} required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Wholesale" /></Field>
            <table className="w-full">
              <thead className="text-[10px] uppercase text-stone-500"><tr><th className="text-left p-1">Item</th><th className="text-right p-1">Standard</th><th className="text-right p-1">List price ₹</th></tr></thead>
              <tbody>
                {products.filter(p => p.status === 'ACTIVE').map(p => {
                  const cur = editing.items.find(i => i.productId === p.id)?.price ?? 0;
                  return (
                    <tr key={p.id}>
                      <td className="p-1 text-ink">{p.name}</td>
                      <td className="p-1 text-right font-mono text-stone-500">{formatINR(p.sellingPrice)}</td>
                      <td className="p-1 text-right">
                        <input type="number" min={0} className={`${inputCls} w-28 text-right font-mono`} value={cur || ''} placeholder="—"
                          onChange={e => { const price = Number(e.target.value); setEditing({ ...editing, items: [...editing.items.filter(i => i.productId !== p.id), ...(price > 0 ? [{ productId: p.id, price }] : [])] }); }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PrimaryButton type="submit">Save price list</PrimaryButton>
          </form>
        )}
      </Drawer>
    </div>
  );
};

// ---------------- barcode labels ----------------

const BarcodeLabels: React.FC = () => {
  const { products, activeBusiness } = useBilling();
  const coded = products.filter(p => p.status === 'ACTIVE' && (p.barcode || p.sku));
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mrp, setMrp] = useState(true);

  const print = () => {
    const labels: string[] = [];
    for (const p of coded) {
      for (let i = 0; i < (qty[p.id] ?? 0); i++) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svg, p.barcode || p.sku, { format: 'CODE128', width: 1.4, height: 38, fontSize: 11, margin: 0 });
        labels.push(`<div class="l"><div class="n">${p.name.replace(/</g, '&lt;')}</div>${svg.outerHTML}${mrp ? `<div class="p">₹${p.sellingPrice.toLocaleString('en-IN')}</div>` : ''}</div>`);
      }
    }
    if (!labels.length) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Labels</title><style>
      @page{size:A4;margin:8mm} body{font-family:system-ui,sans-serif;margin:0}
      .g{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm}
      .l{border:1px dashed #ccc;padding:2mm;text-align:center;break-inside:avoid} .l svg{max-width:100%}
      .n{font-size:9px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .p{font-size:11px;font-weight:800}
      </style></head><body><div class="g">${labels.join('')}</div><p style="font-size:9px;color:#999;text-align:center">${activeBusiness.tradeName || activeBusiness.name}</p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Card className="p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-stone-500">Code 128 labels from each item's barcode (or SKU), 4 per row on A4. Scanners at the POS read them as typed text.</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1"><input type="checkbox" checked={mrp} onChange={e => setMrp(e.target.checked)} /> print price</label>
          <PrimaryButton onClick={print} disabled={!Object.values(qty).some(Boolean)}><Printer className="w-3.5 h-3.5" /> Print labels</PrimaryButton>
        </div>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-mango-100">
          {coded.map(p => (
            <tr key={p.id}>
              <td className="p-2 text-ink font-semibold">{p.name}</td>
              <td className="p-2"><LabelPreview code={p.barcode || p.sku} /></td>
              <td className="p-2 text-right"><input type="number" min={0} className={`${inputCls} w-20 text-right`} value={qty[p.id] ?? 0} onChange={e => setQty({ ...qty, [p.id]: Math.max(0, Number(e.target.value)) })} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {coded.length === 0 && <EmptyState text="Add a barcode or SKU to items to print labels." />}
    </Card>
  );
};

const LabelPreview: React.FC<{ code: string }> = ({ code }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      try {
        JsBarcode(ref.current, code, { format: 'CODE128', width: 1, height: 26, fontSize: 9, margin: 0 });
      } catch {
        /* invalid characters for Code 128 */
      }
    }
  }, [code]);
  return <svg ref={ref} />;
};

