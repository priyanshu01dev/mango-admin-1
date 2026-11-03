import React, { useState, useEffect } from 'react';
import { useDocuments } from '../context/DocumentsContext';
import { isValidDocNumber, recalcItem, invoiceTotals } from '../utils/gst';
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
  Ban,
  CheckCircle2,
  Clock,
  Truck,
  FileCheck2,
  Wallet,
  X,
  FileDown,
  Building2,
  AlertCircle,
  Copy,
  Link2,
  IndianRupee,
  Mail
} from 'lucide-react';
import { get, post, errMsg } from '../api/client';

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
    cancelInvoice,
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
  const { nextInvoiceNumber } = useDocuments();
  const [invoiceNumber, setInvoiceNumber] = useState(() => nextInvoiceNumber());
  // fresh number from Invoice Settings every time the form opens
  useEffect(() => {
    if (isCreateModalOpen) setInvoiceNumber(nextInvoiceNumber());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateModalOpen]);
  const [notes, setNotes] = useState('Goods once sold cannot be returned without original invoice.');
  const [initialAmountPaid, setInitialAmountPaid] = useState<number>(0);
  // bill-level extras (spec §8.4)
  const [billDiscount, setBillDiscount] = useState(0);
  const [freight, setFreight] = useState(0);
  const [packing, setPacking] = useState(0);
  const [tcsRate, setTcsRate] = useState(0);
  const [shippingAddress, setShippingAddress] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [invVehicle, setInvVehicle] = useState('');
  const [invTransporter, setInvTransporter] = useState('');
  const [lrNumber, setLrNumber] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [paymentTds, setPaymentTds] = useState(0);
  // zero-rated supplies (spec §8.4 P1)
  const [supplyType, setSupplyType] = useState<NonNullable<Invoice['supplyType']>>('REGULAR');
  const [lutNumber, setLutNumber] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [portCode, setPortCode] = useState('');
  const [shippingBillNo, setShippingBillNo] = useState('');
  const [godownId, setGodownId] = useState('');
  const [godowns, setGodowns] = useState<{ _id: string; name: string; isDefault: boolean }[]>([]);
  const [partyPrices, setPartyPrices] = useState<{ name: string | null; prices: Record<string, number> }>({ name: null, prices: {} });
  useEffect(() => {
    if (!isCreateModalOpen) return;
    get<{ _id: string; name: string; isDefault: boolean }[]>('/api/godowns').then(setGodowns).catch(() => setGodowns([]));
  }, [isCreateModalOpen]);
  useEffect(() => {
    if (!selectedCustomerId) return setPartyPrices({ name: null, prices: {} });
    get<{ priceList: string | null; prices: Record<string, number> }>(`/api/price-lists/resolve?partyId=${selectedCustomerId}`)
      .then(r => {
        setPartyPrices({ name: r.priceList, prices: r.prices });
        // re-price lines already in the form
        if (r.priceList) setFormItems(prev => prev.map(it => (it.productId && r.prices[it.productId] !== undefined ? recalcItem({ ...it, price: r.prices[it.productId] }, isInterState) : it)));
      })
      .catch(() => setPartyPrices({ name: null, prices: {} }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

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

  // exports and SEZ supplies are always inter-state (IGST)
  const isInterState = supplyType !== 'REGULAR' && supplyType !== 'DEEMED_EXPORT' ? true : customerStateCode !== activeBusiness.stateCode;

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
  const recalculateItem = (item: InvoiceItem, isInter: boolean): InvoiceItem => recalcItem(item, isInter);

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
          item.price = partyPrices.prices[prod.id] ?? prod.sellingPrice;
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

  // Grand totals: same maths as the server (bill discount, taxed charges, TCS, round-off)
  const principalRate = Math.max(0, ...formItems.map(i => i.gstRate));
  const formCharges = [
    { label: 'Freight', amount: freight, gstRate: principalRate },
    { label: 'Packing', amount: packing, gstRate: principalRate }
  ].filter(c => c.amount > 0);
  const lutZeroRated = supplyType.endsWith('WOPAY');
  const totals = lutZeroRated
    ? invoiceTotals(formItems.map(i => ({ ...i, gstRate: 0 })), true, { billDiscount, charges: formCharges.map(c => ({ ...c, gstRate: 0 })), tcsRate })
    : invoiceTotals(formItems, isInterState, { billDiscount, charges: formCharges, tcsRate });
  const { subTotal, totalDiscount, taxableTotal, cgstTotal, sgstTotal, igstTotal, totalGst, roundOff, tcsAmount, chargesTotal } = totals;
  const roundedGrandTotal = totals.grandTotal;

  /** Pre-fills the form from an existing invoice (new number and today's date). */
  const duplicateInvoice = (inv: Invoice) => {
    setSelectedCustomerId(inv.customerId);
    setCustomCustomerName(inv.customerId ? '' : inv.customerName);
    setCustomCustomerPhone(inv.customerId ? '' : inv.customerPhone);
    setCustomCustomerAddress(inv.customerId ? '' : inv.customerAddress);
    setCustomCustomerGstin(inv.customerId ? '' : inv.customerGstin ?? '');
    setCustomerStateCode(inv.customerStateCode);
    setFormItems(inv.items.map((it, i) => recalcItem({ ...it, id: 'item-' + Date.now() + i }, inv.isInterState)));
    setBillDiscount(inv.billDiscount ?? 0);
    setFreight(inv.charges?.find(c => c.label === 'Freight')?.amount ?? 0);
    setPacking(inv.charges?.find(c => c.label === 'Packing')?.amount ?? 0);
    setTcsRate(inv.tcsRate ?? 0);
    setShippingAddress(inv.shippingAddress ?? '');
    setPoNumber('');
    setNotes(inv.notes?.replace(/^CANCELLED:[^|]*\|?\s*/, '') ?? '');
    setInitialAmountPaid(0);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setShowExtras(!!(inv.billDiscount || inv.charges?.length || inv.tcsRate || inv.shippingAddress));
    setIsCreateModalOpen(true);
  };

  // Submit invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = parties.find(p => p.id === selectedCustomerId);
    const custName = customer?.name || customCustomerName || 'Walk-in Retail Buyer';
    const custPhone = customer?.phone || customCustomerPhone || '';
    const custAddress = customer?.billingAddress || customCustomerAddress || '';
    const custGstin = customer?.gstin || customCustomerGstin;

    const num = invoiceNumber.trim().toUpperCase();
    if (!isValidDocNumber(num)) {
      showToast('Invoice number: max 16 characters, only letters, digits, "-" and "/" (GST Rule 46)');
      return;
    }
    if (invoices.some(i => i.businessId === activeBusiness.id && i.invoiceNumber.toUpperCase() === num)) {
      showToast(`Invoice number ${num} already exists. Numbers cannot be reused.`);
      return;
    }

    const balanceDue = Math.max(0, roundedGrandTotal - initialAmountPaid);
    const status: InvoiceStatus = balanceDue === 0 ? 'PAID' : (initialAmountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    const ok = await addInvoice({
      invoiceNumber: num,
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
      eWayBillStatus: 'NOT_GENERATED',
      godownId: godownId || undefined,
      supplyType,
      exportDetails: { lutNumber, currency, exchangeRate: exchangeRate || undefined, portCode, shippingBillNo },
      billDiscount,
      charges: formCharges,
      tcsRate,
      shippingAddress,
      poNumber,
      transport: { mode: 'ROAD', vehicleNumber: invVehicle, transporterName: invTransporter, lrNumber }
    });

    // keep the form open (with what was typed) if the server rejected it
    if (ok) setIsCreateModalOpen(false);
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
      tdsAmount: paymentTds || undefined,
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
      <div className="bg-white border border-mango-100 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-ink">{t.invoices}</h2>
          <p className="text-stone-500 text-xs mt-0.5">
            {language === 'hi' ? 'सभी जीएसटी टैक्स इनवॉइस, भुगतान व ई-वे बिल स्थिति' : 'GST compliant tax invoices with real-time tax calculation'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="bg-mango-50/60 border border-mango-200/70 rounded-xl pl-9 pr-4 py-2 text-xs text-ink placeholder-stone-400 focus:outline-none focus:border-mango-500 w-52 sm:w-64"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center space-x-1 bg-mango-50/60 p-1 rounded-xl border border-mango-200/70">
            {(['ALL', 'PAID', 'UNPAID', 'PARTIALLY_PAID', 'CANCELLED'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-mango-500 text-white font-bold'
                    : 'text-stone-500 hover:text-ink'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'PAID' ? 'Paid' : st === 'UNPAID' ? 'Unpaid' : st === 'CANCELLED' ? 'Cancelled' : 'Part'}
              </button>
            ))}
          </div>

          {/* New Invoice Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-1.5 bg-mango-500 hover:bg-mango-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-md shadow-mango-500/25 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.createNewInvoice}</span>
          </button>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white border border-mango-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-mango-50/70 text-stone-500 uppercase font-semibold text-[10px] tracking-wider border-b border-mango-100">
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
            <tbody className="divide-y divide-mango-100">
              {currentInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-mango-50/60 transition-colors">
                  <td className="p-3.5 pl-5">
                    <span className="font-mono font-bold text-ink block">{inv.invoiceNumber}</span>
                    <span className="text-[10px] text-stone-500">{formatDate(inv.invoiceDate)}</span>
                  </td>

                  <td className="p-3.5">
                    <div className="font-semibold text-ink">{inv.customerName}</div>
                    <div className="text-[10px] font-mono text-leaf-600">
                      {inv.customerGstin || 'Consumer (B2C)'}
                    </div>
                  </td>

                  <td className="p-3.5 text-center">
                    <span className="bg-mango-50/60 px-2 py-0.5 rounded text-[10px] font-mono border border-mango-200/70">
                      {inv.customerStateCode} - {inv.isInterState ? 'IGST' : 'CGST+SGST'}
                    </span>
                  </td>

                  <td className="p-3.5 text-right font-mono">{formatINR(inv.taxableTotal)}</td>
                  <td className="p-3.5 text-right font-mono text-wave-700">{formatINR(inv.totalGst)}</td>
                  <td className="p-3.5 text-right font-bold text-ink font-mono text-sm">
                    {formatINR(inv.grandTotal)}
                  </td>

                  <td className="p-3.5 text-right font-mono font-bold">
                    {inv.balanceDue > 0 ? (
                      <span className="text-rose-600">{formatINR(inv.balanceDue)}</span>
                    ) : (
                      <span className="text-leaf-600">₹0.00</span>
                    )}
                  </td>

                  <td className="p-3.5 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-500/15 text-leaf-600 border border-emerald-500/30'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'bg-amber-500/15 text-mango-600 border border-amber-500/30'
                          : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>

                  {/* Compliance badges: IRN & E-Way */}
                  <td className="p-3.5 text-center space-y-1">
                    {inv.eInvoiceStatus === 'GENERATED' ? (
                      <span className="inline-block bg-teal-500/20 text-teal-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-teal-500/30">
                        IRN ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => generateEInvoice(inv.id)}
                        className="text-[9px] text-stone-500 hover:text-teal-600 block mx-auto underline"
                        title="Generate IRN on NIC"
                      >
                        + IRN
                      </button>
                    )}

                    {inv.eWayBillStatus === 'GENERATED' ? (
                      <span className="inline-block bg-indigo-500/20 text-wave-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">
                        EWB ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setEwayInvoice(inv);
                        }}
                        className="text-[9px] text-stone-500 hover:text-wave-600 block mx-auto underline"
                        title="Generate E-Way Bill"
                      >
                        + E-Way
                      </button>
                    )}
                  </td>

                  {/* Row actions */}
                  <td className="p-3.5 pr-5 text-right space-x-1 whitespace-nowrap">
                    {/* View / Print Tax Invoice */}
                    <button
                      onClick={() => onSelectInvoiceForPrint(inv)}
                      className="p-1.5 rounded-lg bg-mango-50/60 hover:bg-mango-100 text-stone-700 hover:text-ink transition-colors"
                      title={t.printPdf}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Record Payment */}
                    {inv.balanceDue > 0 && (
                      <button
                        onClick={() => {
                          setPayingInvoice(inv);
                          setPaymentAmount(inv.balanceDue);
                        }}
                        className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-wave-600 transition-colors"
                        title={t.markAsPaid}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* WhatsApp */}
                    <button
                      onClick={() => {
                        const text = `Invoice ${inv.invoiceNumber} for ${formatINR(inv.grandTotal)} from ${activeBusiness.name}. Due: ${formatINR(inv.balanceDue)}.`;
                        window.open(`https://wa.me/${inv.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-leaf-600 transition-colors"
                      title={t.shareWhatsapp}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Razorpay payment link / reminder (spec §8.8) */}
                    {inv.balanceDue > 0 && inv.status !== 'CANCELLED' && (
                      <button
                        onClick={async () => {
                          try {
                            const r = await post<{ url: string }>(`/api/invoices/${inv.id}/payment-link`);
                            await navigator.clipboard?.writeText(r.url).catch(() => undefined);
                            const text = `Pay ${formatINR(inv.balanceDue)} for invoice ${inv.invoiceNumber} (${activeBusiness.tradeName || activeBusiness.name}): ${r.url}`;
                            window.open(`https://wa.me/${inv.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                            showToast('Payment link copied');
                          } catch (e) {
                            showToast(errMsg(e));
                          }
                        }}
                        className="p-1.5 rounded-lg bg-leaf-50 hover:bg-leaf-100 text-leaf-700 transition-colors"
                        title="Razorpay payment link (UPI / card)"
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const to = window.prompt('Email invoice to:', parties.find(p => p.id === inv.customerId)?.email ?? '');
                        if (!to) return;
                        try {
                          await post(`/api/invoices/${inv.id}/email`, { to });
                          showToast(`Invoice emailed to ${to}`);
                        } catch (e) {
                          showToast(errMsg(e));
                        }
                      }}
                      className="p-1.5 rounded-lg bg-mango-50/60 hover:bg-mango-100 text-stone-500 hover:text-ink transition-colors"
                      title="Email invoice"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>

                    {/* Public link for the customer (spec §8.7 P1) */}
                    <button
                      onClick={async () => {
                        try {
                          const r = await post<{ path: string }>(`/api/invoices/${inv.id}/share`);
                          const url = window.location.origin + r.path;
                          await navigator.clipboard?.writeText(url).catch(() => undefined);
                          const text = `Invoice ${inv.invoiceNumber} for ${formatINR(inv.grandTotal)} from ${activeBusiness.tradeName || activeBusiness.name}. View & pay: ${url}`;
                          window.open(`https://wa.me/${inv.customerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                          showToast('Invoice link copied');
                        } catch (e) {
                          showToast(errMsg(e));
                        }
                      }}
                      className="p-1.5 rounded-lg bg-mango-50/60 hover:bg-mango-100 text-stone-500 hover:text-ink transition-colors"
                      title="Share invoice link (view & pay online)"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate (spec §8.4) */}
                    <button
                      onClick={() => duplicateInvoice(inv)}
                      className="p-1.5 rounded-lg bg-mango-50/60 hover:bg-mango-100 text-stone-500 hover:text-ink transition-colors"
                      title="Duplicate invoice"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Cancel (Rule 46: number stays in the register, never reused) */}
                    {inv.status !== 'CANCELLED' && (
                      <button
                        onClick={() => {
                          if (inv.eInvoiceStatus === 'GENERATED') {
                            showToast('IRN already generated: cancel the e-invoice on the IRP (within 24 h) or issue a credit note.');
                            return;
                          }
                          const reason = window.prompt(`Cancel invoice ${inv.invoiceNumber}? Enter reason:`);
                          if (reason && reason.trim()) cancelInvoice(inv.id, reason.trim());
                        }}
                        className="p-1.5 rounded-lg bg-mango-50/60 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition-colors"
                        title="Cancel invoice"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {currentInvoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-stone-500 text-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white border border-mango-200/70 text-ink rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[96vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-mango-50 border-b border-mango-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-leaf-600 flex items-center justify-center font-bold">
                  GST
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink">Create GST Tax Invoice</h3>
                  <p className="text-[11px] text-stone-500">
                    Billing from: <strong className="text-stone-800">{activeBusiness.name}</strong> (State: {activeBusiness.state} - {activeBusiness.stateCode})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-stone-500 hover:text-ink rounded-lg hover:bg-mango-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveInvoice} className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Row 1: Invoice Meta */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-mango-50/40 p-4 rounded-xl border border-mango-100">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink focus:outline-none focus:border-mango-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink focus:outline-none focus:border-mango-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink focus:outline-none focus:border-mango-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Place of Supply (State)</label>
                  <select
                    value={customerStateCode}
                    onChange={e => handleStateCodeChange(e.target.value)}
                    className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink focus:outline-none focus:border-mango-500"
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
              <div className="bg-mango-50/40 p-4 rounded-xl border border-mango-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800">Customer (Buyer) Details</span>
                  <span className="text-[11px] text-leaf-600 font-medium">
                    {isInterState ? '⚡ Inter-State Transaction (IGST Applies)' : '⚡ Intra-State Transaction (CGST + SGST Applies)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Select Existing Party</label>
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
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                    >
                      <option value="">-- Choose Party or Enter Below --</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.gstin || 'Consumer'}) - {p.state}
                        </option>
                      ))}
                    </select>
                    {partyPrices.name && <p className="text-[10px] text-leaf-700 font-semibold mt-0.5">Price list: {partyPrices.name}</p>}
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Customer / Business Name</label>
                    <input
                      type="text"
                      required
                      value={customCustomerName}
                      onChange={e => setCustomCustomerName(e.target.value)}
                      placeholder="e.g. Apex Infotech Pvt Ltd"
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Customer GSTIN (Optional if B2C)</label>
                    <input
                      type="text"
                      value={customCustomerGstin}
                      onChange={e => setCustomCustomerGstin(e.target.value.toUpperCase())}
                      placeholder="07AAAAA0000A1Z5"
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Billing Address</label>
                    <input
                      type="text"
                      value={customCustomerAddress}
                      onChange={e => setCustomCustomerAddress(e.target.value)}
                      placeholder="Street, City, Pincode"
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Phone Number (For WhatsApp / SMS)</label>
                    <input
                      type="text"
                      value={customCustomerPhone}
                      onChange={e => setCustomCustomerPhone(e.target.value)}
                      placeholder="+91 98110 00000"
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Items Grid */}
              <div className="bg-mango-50/40 p-4 rounded-xl border border-mango-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800">Items / Goods & Services</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="flex items-center space-x-1 text-leaf-600 hover:text-leaf-700 font-bold text-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Add Item Row</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-stone-500 border-b border-mango-200/70 pb-2">
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
                    <tbody className="divide-y divide-mango-100">
                      {formItems.map((item, idx) => (
                        <tr key={item.id} className="pt-2">
                          <td className="py-2 pr-2">
                            <select
                              value={item.productId || ''}
                              onChange={e => handleItemFieldChange(idx, 'productId', e.target.value)}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 text-xs text-ink"
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
                              className="w-full bg-mango-50 border border-mango-200/70 rounded p-1 text-[11px] text-ink mt-1"
                              placeholder="Description"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={item.hsnCode}
                              onChange={e => handleItemFieldChange(idx, 'hsnCode', e.target.value)}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 font-mono text-ink text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleItemFieldChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 text-ink text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={e => handleItemFieldChange(idx, 'unit', e.target.value)}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 text-ink text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.price}
                              onChange={e => handleItemFieldChange(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 text-ink text-xs"
                            />
                            <label className="flex items-center gap-1 text-[9px] text-stone-500 mt-0.5">
                              <input type="checkbox" checked={!!item.priceIncludesTax} onChange={e => handleItemFieldChange(idx, 'priceIncludesTax', e.target.checked)} />
                              incl. GST
                            </label>
                          </td>

                          <td className="py-2 pr-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={e => handleItemFieldChange(idx, 'discountPercent', parseFloat(e.target.value) || 0)}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 text-ink text-xs"
                            />
                          </td>

                          <td className="py-2 pr-2">
                            <select
                              value={item.gstRate}
                              onChange={e => handleItemFieldChange(idx, 'gstRate', parseFloat(e.target.value))}
                              className="w-full bg-mango-50/60 border border-mango-200/70 rounded p-1.5 text-ink text-xs"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>

                          <td className="py-2 pr-2 text-right font-mono text-stone-700">
                            {formatINR(item.taxableAmount)}
                          </td>

                          <td className="py-2 pr-2 text-right font-mono font-bold text-ink">
                            {formatINR(item.totalAmount)}
                          </td>

                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="text-stone-400 hover:text-rose-600 p-1"
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
                <div className="bg-mango-50/40 p-4 rounded-xl border border-mango-100 space-y-3">
                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">Invoice Notes / Remarks</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                    />
                  </div>

                  <div>
                    <button type="button" onClick={() => setShowExtras(v => !v)} className="text-[11px] font-bold text-mango-700">
                      {showExtras ? '− Hide' : '+ Add'} discount, freight, TCS, shipping & transport
                    </button>
                    {showExtras && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {godowns.length > 1 && (
                          <label className="text-[10px] text-stone-500 col-span-2">Dispatch from godown
                            <select value={godownId} onChange={e => setGodownId(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 text-ink">
                              <option value="">{godowns.find(g => g.isDefault)?.name ?? 'Default'} (default)</option>
                              {godowns.filter(g => !g.isDefault).map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                            </select>
                          </label>
                        )}
                        <label className="text-[10px] text-stone-500 col-span-2">Type of supply
                          <select value={supplyType} onChange={e => setSupplyType(e.target.value as NonNullable<Invoice['supplyType']>)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 text-ink">
                            <option value="REGULAR">Regular (domestic)</option>
                            <option value="EXPORT_WPAY">Export with payment of IGST</option>
                            <option value="EXPORT_WOPAY">Export under LUT (without IGST)</option>
                            <option value="SEZ_WPAY">Supply to SEZ with IGST</option>
                            <option value="SEZ_WOPAY">Supply to SEZ under LUT</option>
                            <option value="DEEMED_EXPORT">Deemed export</option>
                          </select>
                        </label>
                        {supplyType !== 'REGULAR' && (
                          <>
                            {lutZeroRated && (
                              <label className="text-[10px] text-stone-500 col-span-2">LUT / bond number (required)
                                <input value={lutNumber} onChange={e => setLutNumber(e.target.value.toUpperCase())} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" placeholder="AD070326000123X" />
                              </label>
                            )}
                            {supplyType.startsWith('EXPORT') && (
                              <>
                                <label className="text-[10px] text-stone-500">Currency
                                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 text-ink">
                                    {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD'].map(c => <option key={c}>{c}</option>)}
                                  </select>
                                </label>
                                <label className="text-[10px] text-stone-500">₹ per 1 {currency}
                                  <input type="number" min="0" step="0.0001" disabled={currency === 'INR'} value={exchangeRate} onChange={e => setExchangeRate(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                                </label>
                                <label className="text-[10px] text-stone-500">Port code
                                  <input value={portCode} onChange={e => setPortCode(e.target.value.toUpperCase())} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" placeholder="INDEL4" />
                                </label>
                                <label className="text-[10px] text-stone-500">Shipping bill no.
                                  <input value={shippingBillNo} onChange={e => setShippingBillNo(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                                </label>
                              </>
                            )}
                          </>
                        )}
                        <label className="text-[10px] text-stone-500">Bill discount (₹, before GST)
                          <input type="number" min="0" value={billDiscount} onChange={e => setBillDiscount(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500">TCS % (if applicable)
                          <input type="number" min="0" max="5" step="0.1" value={tcsRate} onChange={e => setTcsRate(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500">Freight (₹, taxed {principalRate}%)
                          <input type="number" min="0" value={freight} onChange={e => setFreight(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500">Packing (₹, taxed {principalRate}%)
                          <input type="number" min="0" value={packing} onChange={e => setPacking(Math.max(0, parseFloat(e.target.value) || 0))} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500 col-span-2">Ship to (if different from billing address)
                          <input value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500">Buyer PO number
                          <input value={poNumber} onChange={e => setPoNumber(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500">Vehicle number
                          <input value={invVehicle} onChange={e => setInvVehicle(e.target.value.toUpperCase())} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" placeholder="DL01AB1234" />
                        </label>
                        <label className="text-[10px] text-stone-500">Transporter
                          <input value={invTransporter} onChange={e => setInvTransporter(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 text-ink" />
                        </label>
                        <label className="text-[10px] text-stone-500">LR / docket no.
                          <input value={lrNumber} onChange={e => setLrNumber(e.target.value)} className="w-full bg-white border border-mango-200/70 rounded p-1.5 font-mono text-ink" />
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] text-stone-500 mb-1">
                      Initial Advance / Amount Paid Now (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={roundedGrandTotal}
                      value={initialAmountPaid}
                      onChange={e => setInitialAmountPaid(parseFloat(e.target.value) || 0)}
                      className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-leaf-600 font-bold"
                    />
                    <p className="text-[10px] text-stone-500 mt-1">
                      Remaining balance due: <strong>{formatINR(Math.max(0, roundedGrandTotal - initialAmountPaid))}</strong>
                    </p>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="bg-mango-50/70 p-4 rounded-xl border border-mango-200/70 space-y-2 text-xs">
                  {totals.billDiscount > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>Bill discount:</span>
                      <span className="font-mono text-rose-600">−{formatINR(totals.billDiscount)}</span>
                    </div>
                  )}
                  {chargesTotal > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>Freight / packing:</span>
                      <span className="font-mono text-ink">{formatINR(chargesTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-500">
                    <span>Taxable Amount:</span>
                    <span className="font-mono text-ink">{formatINR(taxableTotal)}</span>
                  </div>

                  {isInterState ? (
                    <div className="flex justify-between text-stone-500">
                      <span>Integrated Tax (IGST):</span>
                      <span className="font-mono text-wave-700">{formatINR(igstTotal)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-stone-500">
                        <span>Central Tax (CGST):</span>
                        <span className="font-mono text-wave-700">{formatINR(cgstTotal)}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span>State Tax (SGST):</span>
                        <span className="font-mono text-wave-700">{formatINR(sgstTotal)}</span>
                      </div>
                    </>
                  )}

                  {tcsAmount > 0 && (
                    <div className="flex justify-between text-stone-500">
                      <span>TCS @ {tcsRate}%:</span>
                      <span className="font-mono text-ink">{formatINR(tcsAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-stone-500">
                    <span>Round Off:</span>
                    <span className="font-mono text-stone-700">{roundOff > 0 ? `+${roundOff}` : roundOff}</span>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-leaf-600 border-t border-mango-200/70 pt-2">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatINR(roundedGrandTotal)}</span>
                  </div>

                  <p className="text-[10px] text-stone-500 italic pt-1">
                    {numberToWordsINR(roundedGrandTotal)}
                  </p>
                </div>
              </div>

              {/* Modal Footer CTA */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-mango-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-mango-50/60 hover:bg-mango-100 text-stone-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-mango-500 hover:bg-mango-600 text-white text-xs font-black shadow-lg shadow-mango-500/25"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="bg-white border border-mango-200/70 text-ink rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-mango-100">
              <h3 className="font-bold text-sm text-ink">Record Invoice Payment</h3>
              <button onClick={() => setPayingInvoice(null)} className="text-stone-500 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-stone-500">
                Invoice: <strong className="text-ink">{payingInvoice.invoiceNumber}</strong>
              </p>
              <p className="text-stone-500">
                Customer: <strong className="text-ink">{payingInvoice.customerName}</strong>
              </p>
              <p className="text-stone-500">
                Total Due: <strong className="text-rose-600">{formatINR(payingInvoice.balanceDue)}</strong>
              </p>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={payingInvoice.balanceDue}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-leaf-600 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">TDS deducted by customer (₹, optional)</label>
                <input
                  type="number"
                  min="0"
                  value={paymentTds}
                  onChange={e => setPaymentTds(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                />
                <p className="text-[10px] text-stone-500 mt-0.5">Amount received + TDS settles the invoice. Claim the TDS credit from Form 26AS.</p>
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as any)}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="CASH">Cash</option>
                  <option value="NEFT_RTGS">Bank NEFT / RTGS / IMPS</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">UTR / Reference Number</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI/4308199201"
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-mango-100">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-3 py-1.5 rounded-lg bg-mango-50/60 text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-mango-500 hover:bg-mango-600 text-white font-bold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="bg-white border border-mango-200/70 text-ink rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-mango-100">
              <h3 className="font-bold text-sm text-ink">Generate E-Way Bill (NIC GST)</h3>
              <button onClick={() => setEwayInvoice(null)} className="text-stone-500 hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-stone-500">
              Generating Part-A & Part-B E-Way Bill for invoice: <strong className="text-ink">{ewayInvoice.invoiceNumber}</strong> ({formatINR(ewayInvoice.grandTotal)})
            </p>

            <form onSubmit={handleGenerateEwaySubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Transporter Name</label>
                <input
                  type="text"
                  required
                  value={transporterName}
                  onChange={e => setTransporterName(e.target.value)}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Transporter ID (GSTIN)</label>
                <input
                  type="text"
                  required
                  value={transporterId}
                  onChange={e => setTransporterId(e.target.value)}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Vehicle Number</label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="DL 1L AA 1234"
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 font-mono text-ink"
                />
              </div>

              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Approx Distance (KM)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={distanceKm}
                  onChange={e => setDistanceKm(parseInt(e.target.value, 10) || 10)}
                  className="w-full bg-mango-50/60 border border-mango-200/70 rounded-lg p-2 text-ink"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-mango-100">
                <button
                  type="button"
                  onClick={() => setEwayInvoice(null)}
                  className="px-3 py-1.5 rounded-lg bg-mango-50/60 text-stone-700"
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
