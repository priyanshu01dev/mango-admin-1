import React, { useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { Invoice, InvoiceItem, InvoiceStatus } from '../types';
import { formatINR, formatDate, TRANSLATIONS, INDIAN_STATES, numberToWordsINR } from '../utils/formatters';
import {
  PlusCircle,
  Search,
  Filter,
  Printer,
  Share2,
  Trash2,
  CheckCircle2,
  Clock,
  Truck,
  FileCheck2,
  Wallet,
  X,
  FileDown,
  Building2,
  AlertCircle
} from 'lucide-react';

interface InvoicesProps {
  onSelectInvoiceForPrint: (inv: Invoice) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
}

export const Invoices: React.FC<InvoicesProps> = ({
  onSelectInvoiceForPrint,
  isCreateModalOpen,
  setIsCreateModalOpen
}) => {
  const {
    language,
    activeBusiness,
    invoices,
    addInvoice,
    deleteInvoice,
    generateEInvoice,
    generateEWayBill,
    parties,
    products,
    recordPayment,
    showToast
  } = useBilling();

  const t = TRANSLATIONS[language];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>('ALL');

  // Record payment modal state
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'NEFT_RTGS' | 'CHEQUE'>('UPI');
  const [paymentRef, setPaymentRef] = useState('');

  // E-Way Bill generation modal state
  const [ewayInvoice, setEwayInvoice] = useState<Invoice | null>(null);
  const [transporterName, setTransporterName] = useState('VRL Logistics Ltd');
  const [transporterId, setTransporterId] = useState('29AABCV1234L1Z8');
  const [vehicleNumber, setVehicleNumber] = useState('DL 1L AA 4590');
  const [distanceKm, setDistanceKm] = useState(45);

  // New Invoice Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState(parties[0]?.id || '');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState('+91 98110 ');
  const [customCustomerGstin, setCustomCustomerGstin] = useState('');
  const [customCustomerAddress, setCustomCustomerAddress] = useState('');
  const [customerStateCode, setCustomerStateCode] = useState(activeBusiness.stateCode); // default to same state

  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [invoiceNumber, setInvoiceNumber] = useState(() => 'INV/2026/00' + (invoices.length + 145));
  const [notes, setNotes] = useState('Goods once sold cannot be returned without original invoice.');
  const [initialAmountPaid, setInitialAmountPaid] = useState<number>(0);

  // Dynamic invoice items
  const [formItems, setFormItems] = useState<InvoiceItem[]>([
    {
      id: 'item-1',
      productId: products[0]?.id || '',
      name: products[0]?.name || 'Havells 1.5 Sq mm Copper Wire (90m Roll)',
      hsnCode: products[0]?.hsnCode || '8544',
      quantity: 5,
      unit: products[0]?.unit || 'ROLL',
      price: products[0]?.sellingPrice || 1850,
      discountPercent: 0,
      gstRate: products[0]?.taxRate || 18,
      taxableAmount: 9250,
      cgstAmount: 832.5,
      sgstAmount: 832.5,
      igstAmount: 0,
      totalAmount: 10915
    }
  ]);

  const isInterState = customerStateCode !== activeBusiness.stateCode;

  // Filter invoices for current business
  const currentInvoices = invoices.filter(inv => {
    const matchesBiz = inv.businessId === activeBusiness.id;
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customerGstin && inv.customerGstin.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesBiz && matchesStatus && matchesSearch;
  });

  // Calculate live item tax & totals
  const recalculateItem = (item: InvoiceItem, isInter: boolean): InvoiceItem => {
    const totalRaw = item.price * item.quantity;
    const discount = (totalRaw * (item.discountPercent || 0)) / 100;
    const taxable = Math.max(0, totalRaw - discount);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInter) {
      igst = (taxable * item.gstRate) / 100;
    } else {
      cgst = (taxable * (item.gstRate / 2)) / 100;
      sgst = (taxable * (item.gstRate / 2)) / 100;
    }

    const total = taxable + cgst + sgst + igst;

    return {
      ...item,
      taxableAmount: parseFloat(taxable.toFixed(2)),
      cgstAmount: parseFloat(cgst.toFixed(2)),
      sgstAmount: parseFloat(sgst.toFixed(2)),
      igstAmount: parseFloat(igst.toFixed(2)),
      totalAmount: parseFloat(total.toFixed(2))
    };
  };

  const handleItemFieldChange = (index: number, field: keyof InvoiceItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      let item = { ...updated[index], [field]: value };

      // If user selected a product dropdown
      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) {
          item.name = prod.name;
          item.hsnCode = prod.hsnCode;
          item.price = prod.sellingPrice;
          item.gstRate = prod.taxRate;
          item.unit = prod.unit;
        }
      }

      item = recalculateItem(item, isInterState);
      updated[index] = item;
      return updated;
    });
  };

  const handleStateCodeChange = (newCode: string) => {
    setCustomerStateCode(newCode);
    const newIsInter = newCode !== activeBusiness.stateCode;
    setFormItems(prev => prev.map(item => recalculateItem(item, newIsInter)));
  };

  const addItemRow = () => {
    const prod = products[0];
    const newItem: InvoiceItem = {
      id: 'item-' + Date.now(),
      productId: prod?.id,
      name: prod?.name || 'Item Name',
      hsnCode: prod?.hsnCode || '9983',
      quantity: 1,
      unit: prod?.unit || 'PCS',
      price: prod?.sellingPrice || 500,
      discountPercent: 0,
      gstRate: prod?.taxRate || 18,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0
    };
    setFormItems(prev => [...prev, recalculateItem(newItem, isInterState)]);
  };

  const removeItemRow = (idx: number) => {
    if (formItems.length === 1) return;
    setFormItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Grand totals
  const subTotal = formItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const totalDiscount = formItems.reduce((acc, i) => acc + ((i.price * i.quantity * (i.discountPercent || 0)) / 100), 0);
  const taxableTotal = formItems.reduce((acc, i) => acc + i.taxableAmount, 0);
  const cgstTotal = formItems.reduce((acc, i) => acc + i.cgstAmount, 0);
  const sgstTotal = formItems.reduce((acc, i) => acc + i.sgstAmount, 0);
  const igstTotal = formItems.reduce((acc, i) => acc + i.igstAmount, 0);
  const totalGst = cgstTotal + sgstTotal + igstTotal;
  const rawGrandTotal = taxableTotal + totalGst;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = parseFloat((roundedGrandTotal - rawGrandTotal).toFixed(2));

  // Submit invoice
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = parties.find(p => p.id === selectedCustomerId);
    const custName = customer?.name || customCustomerName || 'Walk-in Retail Buyer';
    const custPhone = customer?.phone || customCustomerPhone || '+91 99999 99999';
    const custAddress = customer?.billingAddress || customCustomerAddress || 'Local Area, City';
    const custGstin = customer?.gstin || customCustomerGstin;

    const balanceDue = Math.max(0, roundedGrandTotal - initialAmountPaid);
    const status: InvoiceStatus = balanceDue === 0 ? 'PAID' : (initialAmountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    addInvoice({
      invoiceNumber,
      businessId: activeBusiness.id,
      customerId: selectedCustomerId,
      customerName: custName,
      customerGstin: custGstin,
      customerPhone: custPhone,
      customerAddress: custAddress,
      customerStateCode,
      invoiceDate,
      dueDate,
      isInterState,
      items: formItems,
      subTotal: parseFloat(subTotal.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      taxableTotal: parseFloat(taxableTotal.toFixed(2)),
      cgstTotal: parseFloat(cgstTotal.toFixed(2)),
      sgstTotal: parseFloat(sgstTotal.toFixed(2)),
      igstTotal: parseFloat(igstTotal.toFixed(2)),
      totalGst: parseFloat(totalGst.toFixed(2)),
      roundOff,
      grandTotal: roundedGrandTotal,
      amountPaid: initialAmountPaid,
      balanceDue,
      status,
      notes,
      eInvoiceStatus: 'NOT_GENERATED',
      eWayBillStatus: 'NOT_GENERATED'
    });

    setIsCreateModalOpen(false);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    recordPayment({
      businessId: activeBusiness.id,
      type: 'PAYMENT_IN',
      partyId: payingInvoice.customerId,
      partyName: payingInvoice.customerName,
      invoiceId: payingInvoice.id,
      invoiceNumber: payingInvoice.invoiceNumber,
      amount: paymentAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
      mode: paymentMode,
      referenceNumber: paymentRef || 'PAY-' + Date.now().toString().slice(-6),
      notes: 'Recorded via Invoices dashboard'
    });

    setPayingInvoice(null);
  };

  const handleGenerateEwaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ewayInvoice) return;
    generateEWayBill(ewayInvoice.id, {
      transporterName,
      transporterId,
      vehicleNumber,
      approxDistanceKm: distanceKm
    });
    setEwayInvoice(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search / Filters */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">{t.invoices}</h2>
          <p className="text-slate-400 text-xs mt-0.5">
            {language === 'hi' ? 'सभी जीएसटी टैक्स इनवॉइस, भुगतान व ई-वे बिल स्थिति' : 'GST compliant tax invoices with real-time tax calculation'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-52 sm:w-64"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {(['ALL', 'PAID', 'UNPAID', 'PARTIALLY_PAID'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'PAID' ? 'Paid' : st === 'UNPAID' ? 'Unpaid' : 'Part'}
              </button>
            ))}
          </div>

          {/* New Invoice Button */}
          {null}
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5 pl-5">Invoice No / Date</th>
                <th className="p-3.5">Customer & GSTIN</th>
                <th className="p-3.5 text-center">Place of Supply</th>
                <th className="p-3.5 text-right">Taxable</th>
                <th className="p-3.5 text-right">GST (₹)</th>
                <th className="p-3.5 text-right">Grand Total</th>
                <th className="p-3.5 text-right">Balance Due</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Compliance</th>
                <th className="p-3.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {currentInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 pl-5">
                    <span className="font-mono font-bold text-white block">{inv.invoiceNumber}</span>
                    <span className="text-[10px] text-slate-400">{formatDate(inv.invoiceDate)}</span>
                  </td>

                  <td className="p-3.5">
                    <div className="font-semibold text-slate-100">{inv.customerName}</div>
                    <div className="text-[10px] font-mono text-emerald-400">
                      {inv.customerGstin || 'Consumer (B2C)'}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700">
                      {inv.customerStateCode} - {inv.isInterState ? 'IGST' : 'CGST+SGST'}
                    </span>
                  </td>

                  <td className="p-3.5 text-right font-mono">{formatINR(inv.taxableTotal)}</td>
                  <td className="p-3.5 text-right font-mono text-indigo-300">{formatINR(inv.totalGst)}</td>
                  <td className="p-3.5 text-right font-bold text-white font-mono text-sm">
                    {formatINR(inv.grandTotal)}
                  </td>

                  <td className="p-3.5 text-right font-mono font-bold">
                    {inv.balanceDue > 0 ? (
                      <span className="text-rose-400">{formatINR(inv.balanceDue)}</span>
                    ) : (
                      <span className="text-emerald-400">₹0.00</span>
                    )}
                  </td>

                  <td className="p-3.5 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>

                  {/* Compliance badges: IRN & E-Way */}
                  <td className="p-3.5 text-center space-y-1">
                    {inv.eInvoiceStatus === 'GENERATED' ? (
                      <span className="inline-block bg-teal-500/20 text-teal-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-teal-500/30">
                        IRN ✓
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 block" title="Generated from the Mango Invoice app">IRN —</span>
                    )}

                    {inv.eWayBillStatus === 'GENERATED' ? (
                      <span className="inline-block bg-indigo-500/20 text-indigo-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">
                        EWB ✓
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500 block" title="Generated from the Mango Invoice app">EWB —</span>
                    )}
                  </td>

                  {/* Row actions */}
                  <td className="p-3.5 pr-5 text-right space-x-1 whitespace-nowrap">
                    {/* View / Print Tax Invoice */}
                    <button
                      onClick={() => onSelectInvoiceForPrint(inv)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title={t.printPdf}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Record Payment */}
                    {inv.balanceDue > 0 && (
                      null
                    )}

                    {/* WhatsApp */}
                    <button
                      onClick={() => {
                        const text = `Invoice ${inv.invoiceNumber} for ${formatINR(inv.grandTotal)} from ${activeBusiness.name}. Due: ${formatINR(inv.balanceDue)}.`;
                        window.open(`https://wa.me/${inv.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 transition-colors"
                      title={t.shareWhatsapp}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    {null}
                  </td>
                </tr>
              ))}

              {currentInvoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 text-xs">
                    No invoices found. Click <strong>+ New Invoice</strong> to create your first GST bill.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW GST INVOICE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[96vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-850 border-b border-slate-850">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  GST
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Create GST Tax Invoice</h3>
                  <p className="text-[11px] text-slate-400">
                    Billing from: <strong className="text-slate-200">{activeBusiness.name}</strong> (State: {activeBusiness.state} - {activeBusiness.stateCode})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveInvoice} className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Row 1: Invoice Meta */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Place of Supply (State)</label>
                  <select
                    value={customerStateCode}
                    onChange={e => handleStateCodeChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {Object.entries(INDIAN_STATES).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} - {name} {code === activeBusiness.stateCode ? '(Intra-State: CGST+SGST)' : '(Inter-State: IGST)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Customer Selection */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Customer (Buyer) Details</span>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {isInterState ? '⚡ Inter-State Transaction (IGST Applies)' : '⚡ Intra-State Transaction (CGST + SGST Applies)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Select Existing Party</label>
                    <select
                      value={selectedCustomerId}
                      onChange={e => {
                        const id = e.target.value;
                        setSelectedCustomerId(id);
                        const party = parties.find(p => p.id === id);
                        if (party) {
                          setCustomCustomerName(party.name);
                          setCustomCustomerPhone(party.phone);
                          setCustomCustomerGstin(party.gstin || '');
                          setCustomCustomerAddress(party.billingAddress);
                          handleStateCodeChange(party.stateCode || activeBusiness.stateCode);
                        }
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="">-- Choose Party or Enter Below --</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.gstin || 'Consumer'}) - {p.state}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Customer / Business Name</label>
                    <input
                      type="text"
                      required
                      value={customCustomerName}
                      onChange={e => setCustomCustomerName(e.target.value)}
                      placeholder="e.g. Apex Infotech Pvt Ltd"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Customer GSTIN (Optional if B2C)</label>
                    <input
                      type="text"
                      value={customCustomerGstin}
                      onChange={e => setCustomCustomerGstin(e.target.value.toUpperCase())}
                      placeholder="07AAAAA0000A1Z5"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Billing Address</label>
                    <input
                      type="text"
                      value={customCustomerAddress}
                      onChange={e => setCustomCustomerAddress(e.target.value)}
                      placeholder="Street, City, Pincode"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Phone Number (For WhatsApp / SMS)</label>
                    <input
                      type="text"
                      value={customCustomerPhone}
                      onChange={e => setCustomCustomerPhone(e.target.value)}
                      placeholder="+91 98110 00000"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Items Grid */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Items / Goods & Services</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-bold text-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Add Item Row</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700 pb-2">
                        <th className="pb-2 w-56">Item / Product</th>
                        <th className="pb-2 w-24">HSN Code</th>
                        <th className="pb-2 w-20">Qty</th>
                        <th className="pb-2 w-20">Unit</th>
                        <th className="pb-2 w-24">Price (₹)</th>
                        <th className="pb-2 w-20">Disc %</th>
                        <th className="pb-2 w-24">GST %</th>
                        <th className="pb-2 w-28 text-right">Taxable</th>
                        <th className="pb-2 w-28 text-right">Total (₹)</th>
                        <th className="pb-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {formItems.map((item, idx) => (
                        <tr key={item.id} className="pt-2">
                          <td className="py-2 pr-2">
                            <select
                              value={item.productId || ''}
                              onChange={e => handleItemFieldChange(idx, 'productId', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs text-white"
                            >
                              <option value="">-- Custom Item --</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.currentStock})
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={item.name}
                              onChange={e => handleItemFieldChange(idx, 'name', e.target.value)}
                              className="w-full bg-slate-850 border border-slate-700 rounded p-1 text-[11px] text-white mt-1"
                              placeholder="Description"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={item.hsnCode}
                              onChange={e => handleItemFieldChange(idx, 'hsnCode', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={e => handleItemFieldChange(idx, 'unit', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={e => handleItemFieldChange(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={e => handleItemFieldChange(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <select
                              value={item.gstRate}
                              onChange={e => handleItemFieldChange(idx, 'gstRate', parseFloat(e.target.value))}
                              className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white text-xs"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>

                          <td className="py-2 pr-2 text-right font-mono text-slate-300">
                            {formatINR(item.taxableAmount)}
                          </td>

                          <td className="py-2 pr-2 text-right font-mono font-bold text-white">
                            {formatINR(item.totalAmount)}
                          </td>

                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Row 4: Calculation Summary & Payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Invoice Notes / Remarks</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Initial Advance / Amount Paid Now (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={roundedGrandTotal}
                      value={initialAmountPaid}
                      onChange={e => setInitialAmountPaid(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Remaining balance due: <strong>{formatINR(Math.max(0, roundedGrandTotal - initialAmountPaid))}</strong>
                    </p>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Taxable Amount:</span>
                    <span className="font-mono text-white">{formatINR(taxableTotal)}</span>
                  </div>

                  {isInterState ? (
                    <div className="flex justify-between text-slate-400">
                      <span>Integrated Tax (IGST):</span>
                      <span className="font-mono text-indigo-300">{formatINR(igstTotal)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span>Central Tax (CGST):</span>
                        <span className="font-mono text-indigo-300">{formatINR(cgstTotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>State Tax (SGST):</span>
                        <span className="font-mono text-indigo-300">{formatINR(sgstTotal)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span>Round Off:</span>
                    <span className="font-mono text-slate-300">{roundOff > 0 ? `+${roundOff}` : roundOff}</span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-emerald-400 border-t border-slate-700 pt-2">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatINR(roundedGrandTotal)}</span>
                  </div>

                  <p className="text-[10px] text-slate-400 italic pt-1">
                    {numberToWordsINR(roundedGrandTotal)}
                  </p>
                </div>
              </div>

              {/* Modal Footer CTA */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20"
                >
                  Save & Generate Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Record Invoice Payment</h3>
              <button onClick={() => setPayingInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-slate-400">
                Invoice: <strong className="text-white">{payingInvoice.invoiceNumber}</strong>
              </p>
              <p className="text-slate-400">
                Customer: <strong className="text-white">{payingInvoice.customerName}</strong>
              </p>
              <p className="text-slate-400">
                Total Due: <strong className="text-rose-400">{formatINR(payingInvoice.balanceDue)}</strong>
              </p>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={payingInvoice.balanceDue}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="CASH">Cash</option>
                  <option value="NEFT_RTGS">Bank NEFT / RTGS / IMPS</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">UTR / Reference Number</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI/4308199201"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE E-WAY BILL MODAL */}
      {ewayInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1a17]/50 p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Generate E-Way Bill (NIC GST)</h3>
              <button onClick={() => setEwayInvoice(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400">
              Generating Part-A & Part-B E-Way Bill for invoice: <strong className="text-white">{ewayInvoice.invoiceNumber}</strong> ({formatINR(ewayInvoice.grandTotal)})
            </p>

            <form onSubmit={handleGenerateEwaySubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Transporter Name</label>
                <input
                  type="text"
                  required
                  value={transporterName}
                  onChange={e => setTransporterName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Transporter ID (GSTIN)</label>
                <input
                  type="text"
                  required
                  value={transporterId}
                  onChange={e => setTransporterId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Vehicle Number</label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="DL 1L AA 1234"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Approx Distance (KM)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={distanceKm}
                  onChange={e => setDistanceKm(parseInt(e.target.value, 10) || 10)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEwayInvoice(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold"
                >
                  Generate E-Way Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
