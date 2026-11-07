import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { Product } from '../types';
import { formatINR, TRANSLATIONS } from '../utils/formatters';
import {
  Boxes,
  PlusCircle,
  Search,
  AlertTriangle,
  ArrowDownUp,
  PackagePlus,
  PackageMinus,
  X,
  Tag,
  CheckCircle2
} from 'lucide-react';

export const Inventory: React.FC = () => {
  const { language, activeBusiness, products, addProduct, adjustProductStock, updateProduct } = useBilling();
  const t = TRANSLATIONS[language];

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustReason, setAdjustReason] = useState('Stock Purchase / Refill');

  // New product form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [hsnCode, setHsnCode] = useState('8536');
  const [category, setCategory] = useState('Electricals');
  const [unit, setUnit] = useState('PCS');
  const [purchasePrice, setPurchasePrice] = useState(100);
  const [sellingPrice, setSellingPrice] = useState(150);
  const [taxRate, setTaxRate] = useState(18);
  const [currentStock, setCurrentStock] = useState(25);
  const [minStockAlert, setMinStockAlert] = useState(10);

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesBiz = p.businessId === activeBusiness.id;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.hsnCode.includes(searchTerm);
    const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
    const matchesLowStock = !onlyLowStock || (!p.isService && p.currentStock < p.minStockAlert);
    return matchesBiz && matchesSearch && matchesCategory && matchesLowStock;
  });

  const totalStockCount = filteredProducts.reduce((acc, p) => acc + p.currentStock, 0);
  const totalStockValue = filteredProducts.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
  const lowStockCount = products.filter(p => p.businessId === activeBusiness.id && (!p.isService && p.currentStock < p.minStockAlert)).length;

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    addProduct({
      businessId: activeBusiness.id,
      name,
      sku: sku || 'SKU-' + Date.now().toString().slice(-4),
      hsnCode,
      category,
      unit,
      purchasePrice,
      sellingPrice,
      taxRate,
      currentStock,
      minStockAlert,
      status: 'ACTIVE'
    });
    setIsAddModalOpen(false);
    // Reset form
    setName('');
    setSku('');
  };

  const handleStockAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const change = adjustType === 'IN' ? Math.abs(adjustQty) : -Math.abs(adjustQty);
    adjustProductStock(adjustingProduct.id, change, adjustReason);
    setAdjustingProduct(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Items</span>
            <div className="text-2xl font-black text-white mt-1">{filteredProducts.length} Products</div>
            <p className="text-[11px] text-slate-400 mt-0.5">{totalStockCount} Total Units on Hand</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Stock Valuation</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{formatINR(totalStockValue)}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Calculated at purchase cost</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Low Stock Warnings</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{lowStockCount} Items</div>
            <button
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              className="text-[11px] text-amber-300 hover:underline mt-0.5 block font-semibold"
            >
              {onlyLowStock ? 'Show all products' : 'Filter low stock only →'}
            </button>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search product, SKU or HSN..."
              className="bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 w-52 sm:w-64"
            />
          </div>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
          >
            {categories.map(c => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>
        </div>

        {null}
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-5">Product Name & SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-center">HSN Code</th>
                <th className="p-3.5 text-center">GST Rate</th>
                <th className="p-3.5 text-right">Purchase (₹)</th>
                <th className="p-3.5 text-right">Selling (₹)</th>
                <th className="p-3.5 text-right">Margin</th>
                <th className="p-3.5 text-center">Current Stock</th>
                <th className="p-3.5 pr-5 text-right">Stock Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredProducts.map(prod => {
                const margin = prod.sellingPrice - prod.purchasePrice;
                const marginPct = prod.purchasePrice > 0 ? ((margin / prod.purchasePrice) * 100).toFixed(0) : 0;
                const isLow = (!prod.isService && prod.currentStock < prod.minStockAlert);

                return (
                  <tr key={prod.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-white text-xs">{prod.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">SKU: {prod.sku}</div>
                    </td>

                    <td className="p-3.5">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300 border border-slate-700">
                        {prod.category}
                      </span>
                    </td>

                    <td className="p-3.5 text-center font-mono text-slate-400">{prod.hsnCode}</td>
                    <td className="p-3.5 text-center font-mono text-indigo-300 font-bold">{prod.taxRate}%</td>
                    <td className="p-3.5 text-right font-mono">{formatINR(prod.purchasePrice)}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-white">{formatINR(prod.sellingPrice)}</td>

                    <td className="p-3.5 text-right font-mono text-emerald-400 font-semibold">
                      +{marginPct}%
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                          isLow
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {prod.currentStock} {prod.unit}
                      </span>
                      {isLow && (
                        <span className="block text-[9px] text-rose-400 font-bold mt-0.5">LOW STOCK</span>
                      )}
                    </td>

                    <td className="p-3.5 pr-5 text-right">
                      <span className="text-[10px] text-slate-500">{prod.isService ? "Service" : "Synced"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADJUST STOCK MODAL */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Adjust Stock: {adjustingProduct.name}</h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex justify-between items-center">
              <span>Current Available:</span>
              <strong className="text-emerald-400 text-sm font-mono">
                {adjustingProduct.currentStock} {adjustingProduct.unit}
              </strong>
            </div>

            <form onSubmit={handleStockAdjustmentSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('IN')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center space-x-1.5 ${
                    adjustType === 'IN'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>+ Stock IN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdjustType('OUT')}
                  className={`p-2.5 rounded-xl border font-bold flex items-center justify-center space-x-1.5 ${
                    adjustType === 'OUT'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <PackageMinus className="w-4 h-4" />
                  <span>- Stock OUT</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Quantity ({adjustingProduct.unit})</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={e => setAdjustQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white text-base"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Add New Product / Item</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Havells 2.5 Sq mm Wire"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">SKU / Item Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={e => setSku(e.target.value.toUpperCase())}
                    placeholder="EL-WIR-002"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">HSN / SAC Code</label>
                  <input
                    type="text"
                    required
                    value={hsnCode}
                    onChange={e => setHsnCode(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Unit of Measurement</label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="BOX">BOX (Boxes)</option>
                    <option value="ROLL">ROLL (Rolls)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="LTR">LTR (Litres)</option>
                    <option value="MTR">MTR (Metres)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Purchase Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={sellingPrice}
                    onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">GST Tax Rate</label>
                  <select
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={currentStock}
                    onChange={e => setCurrentStock(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Min Stock Alert Threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={minStockAlert}
                    onChange={e => setMinStockAlert(parseInt(e.target.value, 10) || 5)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
