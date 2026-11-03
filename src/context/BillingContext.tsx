import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BusinessProfile,
  Invoice,
  Quotation,
  Product,
  Party,
  PaymentTransaction,
  EWayBillRecord,
  EInvoiceRecord,
  AuditLog,
  Language,
  SubscriptionPlan
} from '../types';
import {
  INITIAL_BUSINESSES,
  INITIAL_PRODUCTS,
  INITIAL_PARTIES,
  INITIAL_INVOICES,
  INITIAL_QUOTATIONS,
  INITIAL_PAYMENTS,
  INITIAL_EWAY_BILLS,
  INITIAL_E_INVOICES,
  SUBSCRIPTION_PLANS,
  AUDIT_LOGS
} from '../data/mockData';

interface BillingContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  businesses: BusinessProfile[];
  activeBusiness: BusinessProfile;
  setActiveBusinessId: (id: string) => void;
  updateBusinessProfile: (profile: BusinessProfile) => void;
  
  invoices: Invoice[];
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => void;
  deleteInvoice: (id: string) => void;
  generateEWayBill: (invoiceId: string, details: { transporterName: string; transporterId: string; vehicleNumber: string; approxDistanceKm: number }) => EWayBillRecord;
  generateEInvoice: (invoiceId: string) => EInvoiceRecord;
  
  quotations: Quotation[];
  addQuotation: (quotation: Omit<Quotation, 'id'>) => Quotation;
  convertQuotationToInvoice: (quotationId: string) => Invoice | null;
  
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  adjustProductStock: (productId: string, quantityChange: number, reason: string) => void;
  
  parties: Party[];
  addParty: (party: Omit<Party, 'id'>) => void;
  updateParty: (party: Party) => void;
  
  payments: PaymentTransaction[];
  recordPayment: (payment: Omit<PaymentTransaction, 'id'>) => void;
  
  ewayBills: EWayBillRecord[];
  eInvoices: EInvoiceRecord[];
  subscriptionPlans: SubscriptionPlan[];
  auditLogs: AuditLog[];
  
  selectedInvoiceForPrint: Invoice | null;
  setSelectedInvoiceForPrint: (inv: Invoice | null) => void;
  
  quickNotification: string | null;
  showToast: (msg: string) => void;
  resetAllToDefault: () => void;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('gimbooks_lang') as Language) || 'hi'; // Default to Hindi as per user's prompt!
  });

  const [businesses, setBusinesses] = useState<BusinessProfile[]>(() => {
    const saved = localStorage.getItem('gimbooks_businesses');
    return saved ? JSON.parse(saved) : INITIAL_BUSINESSES;
  });

  const [activeBusinessId, setActiveBusinessIdState] = useState<string>(() => {
    return localStorage.getItem('gimbooks_active_biz') || 'biz-1';
  });

  const activeBusiness = businesses.find(b => b.id === activeBusinessId) || businesses[0];

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('gimbooks_invoices');
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    const saved = localStorage.getItem('gimbooks_quotations');
    return saved ? JSON.parse(saved) : INITIAL_QUOTATIONS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('gimbooks_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [parties, setParties] = useState<Party[]>(() => {
    const saved = localStorage.getItem('gimbooks_parties');
    return saved ? JSON.parse(saved) : INITIAL_PARTIES;
  });

  const [payments, setPayments] = useState<PaymentTransaction[]>(() => {
    const saved = localStorage.getItem('gimbooks_payments');
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  const [ewayBills, setEwayBills] = useState<EWayBillRecord[]>(() => {
    const saved = localStorage.getItem('gimbooks_eway');
    return saved ? JSON.parse(saved) : INITIAL_EWAY_BILLS;
  });

  const [eInvoices, setEInvoices] = useState<EInvoiceRecord[]>(() => {
    const saved = localStorage.getItem('gimbooks_einv');
    return saved ? JSON.parse(saved) : INITIAL_E_INVOICES;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('gimbooks_audit');
    return saved ? JSON.parse(saved) : AUDIT_LOGS;
  });

  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [quickNotification, setQuickNotification] = useState<string | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('gimbooks_lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('gimbooks_businesses', JSON.stringify(businesses));
  }, [businesses]);

  useEffect(() => {
    localStorage.setItem('gimbooks_active_biz', activeBusinessId);
  }, [activeBusinessId]);

  useEffect(() => {
    localStorage.setItem('gimbooks_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('gimbooks_quotations', JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem('gimbooks_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('gimbooks_parties', JSON.stringify(parties));
  }, [parties]);

  useEffect(() => {
    localStorage.setItem('gimbooks_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('gimbooks_eway', JSON.stringify(ewayBills));
  }, [ewayBills]);

  useEffect(() => {
    localStorage.setItem('gimbooks_einv', JSON.stringify(eInvoices));
  }, [eInvoices]);

  useEffect(() => {
    localStorage.setItem('gimbooks_audit', JSON.stringify(auditLogs));
  }, [auditLogs]);

  const showToast = (msg: string) => {
    setQuickNotification(msg);
    setTimeout(() => {
      setQuickNotification(null);
    }, 4000);
  };

  const addAuditLog = (action: string, details: string, status: 'SUCCESS' | 'WARNING' | 'FAILED' = 'SUCCESS') => {
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      userName: 'Admin User',
      role: 'Super Admin',
      ipAddress: '103.212.144.' + Math.floor(Math.random() * 80 + 10),
      action,
      details,
      status
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const setActiveBusinessId = (id: string) => {
    setActiveBusinessIdState(id);
    const b = businesses.find(x => x.id === id);
    if (b) showToast(`Switched to business: ${b.name}`);
  };

  const updateBusinessProfile = (profile: BusinessProfile) => {
    setBusinesses(prev => prev.map(b => b.id === profile.id ? profile : b));
    showToast(language === 'hi' ? 'बिजनेस प्रोफाइल सफलतापूर्वक अपडेट हुई' : 'Business profile updated successfully');
    addAuditLog('BUSINESS_UPDATE', `Updated profile settings for ${profile.name}`);
  };

  // Add new Invoice
  const addInvoice = (invData: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    const newId = 'inv-' + Date.now();
    const newInvoice: Invoice = {
      ...invData,
      id: newId,
      createdAt: new Date().toISOString()
    };

    setInvoices(prev => [newInvoice, ...prev]);

    // Deduct stock for products
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = newInvoice.items.find(i => i.productId === prod.id || i.name === prod.name);
        if (item) {
          const newStock = Math.max(0, prod.currentStock - item.quantity);
          return { ...prod, currentStock: newStock };
        }
        return prod;
      });
    });

    // Update customer balance (receivable)
    if (newInvoice.balanceDue > 0 && newInvoice.customerId) {
      setParties(prevParties => {
        return prevParties.map(p => {
          if (p.id === newInvoice.customerId) {
            return { ...p, currentBalance: p.currentBalance + newInvoice.balanceDue };
          }
          return p;
        });
      });
    }

    // If initial payment was made with invoice, record it
    if (newInvoice.amountPaid > 0) {
      const paymentRecord: PaymentTransaction = {
        id: 'pay-' + Date.now(),
        businessId: newInvoice.businessId,
        type: 'PAYMENT_IN',
        partyId: newInvoice.customerId,
        partyName: newInvoice.customerName,
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        amount: newInvoice.amountPaid,
        paymentDate: newInvoice.invoiceDate,
        mode: 'UPI',
        referenceNumber: 'AUTO-REC-' + Date.now().toString().slice(-6),
        notes: 'Initial payment collected during invoice creation'
      };
      setPayments(prev => [paymentRecord, ...prev]);
    }

    showToast(language === 'hi' ? `इनवॉइस ${newInvoice.invoiceNumber} सफलतापूर्वक बनाई गई` : `Invoice ${newInvoice.invoiceNumber} created successfully`);
    addAuditLog('INVOICE_CREATE', `Created Tax Invoice ${newInvoice.invoiceNumber} for ₹${newInvoice.grandTotal}`);

    return newInvoice;
  };

  const updateInvoiceStatus = (id: string, status: Invoice['status']) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        return { ...inv, status };
      }
      return inv;
    }));
    showToast(language === 'hi' ? 'इनवॉइस स्टेटस अपडेट किया गया' : 'Invoice status updated');
  };

  const deleteInvoice = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    setInvoices(prev => prev.filter(i => i.id !== id));
    showToast(language === 'hi' ? `इनवॉइस ${inv.invoiceNumber} हटाई गई` : `Invoice ${inv.invoiceNumber} deleted`);
    addAuditLog('INVOICE_DELETE', `Deleted invoice ${inv.invoiceNumber}`);
  };

  const generateEWayBill = (invoiceId: string, details: { transporterName: string; transporterId: string; vehicleNumber: string; approxDistanceKm: number }): EWayBillRecord => {
    const inv = invoices.find(i => i.id === invoiceId);
    const ewbNumber = '24' + Math.floor(1000000000 + Math.random() * 9000000000);
    const validDate = new Date();
    validDate.setDate(validDate.getDate() + 2);

    const record: EWayBillRecord = {
      id: 'ewb-' + Date.now(),
      ewbNumber,
      invoiceNumber: inv ? inv.invoiceNumber : 'INV-GEN',
      invoiceId,
      fromGstin: activeBusiness.gstin,
      toGstin: inv?.customerGstin || 'URP-UNREGISTERED',
      transporterName: details.transporterName,
      transporterId: details.transporterId,
      vehicleNumber: details.vehicleNumber,
      approxDistanceKm: details.approxDistanceKm,
      supplyType: 'Outward',
      documentType: 'Tax Invoice',
      generatedDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
      validUpto: validDate.toISOString().replace('T', ' ').slice(0, 16),
      status: 'ACTIVE'
    };

    setEwayBills(prev => [record, ...prev]);
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, eWayBillStatus: 'GENERATED', eWayBillNumber: ewbNumber } : i));
    showToast(language === 'hi' ? `ई-वे बिल ${ewbNumber} सफलतापूर्वक जनरेट हुआ` : `E-Way Bill ${ewbNumber} generated`);
    addAuditLog('EWAY_GENERATE', `Generated E-Way Bill ${ewbNumber} for invoice ${inv?.invoiceNumber}`);
    return record;
  };

  const generateEInvoice = (invoiceId: string): EInvoiceRecord => {
    const inv = invoices.find(i => i.id === invoiceId);
    const chars = '0123456789abcdef';
    let irn = '';
    for (let i = 0; i < 64; i++) {
      irn += chars[Math.floor(Math.random() * chars.length)];
    }
    const ackNo = '11' + Math.floor(10000000000 + Math.random() * 90000000000);

    const record: EInvoiceRecord = {
      id: 'einv-' + Date.now(),
      irn,
      ackNo,
      ackDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      invoiceNumber: inv?.invoiceNumber || 'INV-GEN',
      invoiceId,
      buyerGstin: inv?.customerGstin || 'URP',
      totalValue: inv?.grandTotal || 0,
      status: 'ACTIVE',
      signedQrCodePayload: `GSTIN:${activeBusiness.gstin}:INV:${inv?.invoiceNumber}:VAL:${inv?.grandTotal}:IRN:${irn.slice(0, 16)}`
    };

    setEInvoices(prev => [record, ...prev]);
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, eInvoiceStatus: 'GENERATED', irnNumber: irn } : i));
    showToast(language === 'hi' ? 'ई-इनवॉइस (IRN) सफलतापूर्वक जारी किया गया' : 'E-Invoice IRN generated successfully');
    addAuditLog('EINVOICE_GENERATE', `Generated E-Invoice IRN for ${inv?.invoiceNumber}`);
    return record;
  };

  const addQuotation = (quotData: Omit<Quotation, 'id'>): Quotation => {
    const newQuot: Quotation = {
      ...quotData,
      id: 'quot-' + Date.now()
    };
    setQuotations(prev => [newQuot, ...prev]);
    showToast(language === 'hi' ? `कोटेशन ${newQuot.quotationNumber} बनाया गया` : `Quotation ${newQuot.quotationNumber} created`);
    addAuditLog('QUOTATION_CREATE', `Created quotation ${newQuot.quotationNumber}`);
    return newQuot;
  };

  const convertQuotationToInvoice = (quotationId: string): Invoice | null => {
    const quot = quotations.find(q => q.id === quotationId);
    if (!quot) return null;

    const invoiceNum = 'INV/2026/00' + (invoices.length + 145);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const newInv = addInvoice({
      invoiceNumber: invoiceNum,
      businessId: quot.businessId,
      customerId: quot.customerId,
      customerName: quot.customerName,
      customerGstin: quot.customerGstin,
      customerPhone: quot.customerPhone,
      customerAddress: quot.customerAddress,
      customerStateCode: quot.customerStateCode,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      isInterState: quot.isInterState,
      items: quot.items,
      subTotal: quot.items.reduce((acc, i) => acc + (i.price * i.quantity), 0),
      totalDiscount: quot.items.reduce((acc, i) => acc + ((i.price * i.quantity * i.discountPercent) / 100), 0),
      taxableTotal: quot.items.reduce((acc, i) => acc + i.taxableAmount, 0),
      cgstTotal: quot.items.reduce((acc, i) => acc + i.cgstAmount, 0),
      sgstTotal: quot.items.reduce((acc, i) => acc + i.sgstAmount, 0),
      igstTotal: quot.items.reduce((acc, i) => acc + i.igstAmount, 0),
      totalGst: quot.items.reduce((acc, i) => acc + (i.cgstAmount + i.sgstAmount + i.igstAmount), 0),
      roundOff: 0,
      grandTotal: quot.grandTotal,
      amountPaid: 0,
      balanceDue: quot.grandTotal,
      status: 'UNPAID',
      notes: `Converted from Quotation ${quot.quotationNumber}. ${quot.notes || ''}`
    });

    setQuotations(prev => prev.map(q => q.id === quotationId ? { ...q, status: 'CONVERTED', convertedInvoiceId: newInv.id } : q));
    showToast(language === 'hi' ? `कोटेशन को इनवॉइस ${invoiceNum} में बदल दिया गया` : `Quotation converted to Invoice ${invoiceNum}`);
    return newInv;
  };

  const addProduct = (prodData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...prodData,
      id: 'prod-' + Date.now()
    };
    setProducts(prev => [newProd, ...prev]);
    showToast(language === 'hi' ? `प्रोडक्ट ${newProd.name} जोड़ा गया` : `Product ${newProd.name} added`);
    addAuditLog('PRODUCT_ADD', `Added product SKU ${newProd.sku} (${newProd.name})`);
  };

  const updateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    showToast(language === 'hi' ? 'प्रोडक्ट अपडेट किया गया' : 'Product updated');
  };

  const adjustProductStock = (productId: string, quantityChange: number, reason: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const newStock = Math.max(0, p.currentStock + quantityChange);
        return { ...p, currentStock: newStock };
      }
      return p;
    }));
    showToast(language === 'hi' ? `स्टॉक अपडेट: ${quantityChange > 0 ? '+' : ''}${quantityChange} (${reason})` : `Stock updated by ${quantityChange}`);
    addAuditLog('STOCK_ADJUST', `Adjusted stock for ${productId} by ${quantityChange}: ${reason}`);
  };

  const addParty = (partyData: Omit<Party, 'id'>) => {
    const newParty: Party = {
      ...partyData,
      id: 'party-' + Date.now()
    };
    setParties(prev => [newParty, ...prev]);
    showToast(language === 'hi' ? `${newParty.name} को सफलता से जोड़ा गया` : `Party ${newParty.name} added`);
    addAuditLog('PARTY_ADD', `Created new party: ${newParty.name} (${newParty.type})`);
  };

  const updateParty = (updated: Party) => {
    setParties(prev => prev.map(p => p.id === updated.id ? updated : p));
    showToast(language === 'hi' ? 'पार्टी विवरण अपडेट हुआ' : 'Party details updated');
  };

  const recordPayment = (payData: Omit<PaymentTransaction, 'id'>) => {
    const newPayment: PaymentTransaction = {
      ...payData,
      id: 'pay-' + Date.now()
    };
    setPayments(prev => [newPayment, ...prev]);

    // If tied to an invoice, adjust invoice balance and status
    if (newPayment.invoiceId) {
      setInvoices(prev => prev.map(inv => {
        if (inv.id === newPayment.invoiceId) {
          const newPaid = inv.amountPaid + newPayment.amount;
          const newBalance = Math.max(0, inv.grandTotal - newPaid);
          const newStatus: Invoice['status'] = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          return {
            ...inv,
            amountPaid: newPaid,
            balanceDue: newBalance,
            status: newStatus
          };
        }
        return inv;
      }));
    }

    // Adjust party balance
    setParties(prev => prev.map(p => {
      if (p.id === newPayment.partyId) {
        if (newPayment.type === 'PAYMENT_IN') {
          return { ...p, currentBalance: Math.max(0, p.currentBalance - newPayment.amount) };
        } else {
          return { ...p, currentBalance: p.currentBalance + newPayment.amount };
        }
      }
      return p;
    }));

    showToast(language === 'hi' ? `₹${newPayment.amount} का भुगतान दर्ज हुआ` : `Payment of ₹${newPayment.amount} recorded`);
    addAuditLog('PAYMENT_RECEIVE', `Recorded payment of ₹${newPayment.amount} from ${newPayment.partyName}`);
  };

  const resetAllToDefault = () => {
    localStorage.clear();
    setBusinesses(INITIAL_BUSINESSES);
    setProducts(INITIAL_PRODUCTS);
    setParties(INITIAL_PARTIES);
    setInvoices(INITIAL_INVOICES);
    setQuotations(INITIAL_QUOTATIONS);
    setPayments(INITIAL_PAYMENTS);
    setEwayBills(INITIAL_EWAY_BILLS);
    setEInvoices(INITIAL_E_INVOICES);
    setAuditLogs(AUDIT_LOGS);
    showToast(language === 'hi' ? 'डेटा रीसेट हो गया है' : 'Demo data reset to default');
  };

  return (
    <BillingContext.Provider
      value={{
        language,
        setLanguage,
        businesses,
        activeBusiness,
        setActiveBusinessId,
        updateBusinessProfile,
        invoices,
        addInvoice,
        updateInvoiceStatus,
        deleteInvoice,
        generateEWayBill,
        generateEInvoice,
        quotations,
        addQuotation,
        convertQuotationToInvoice,
        products,
        addProduct,
        updateProduct,
        adjustProductStock,
        parties,
        addParty,
        updateParty,
        payments,
        recordPayment,
        ewayBills,
        eInvoices,
        subscriptionPlans: SUBSCRIPTION_PLANS,
        auditLogs,
        selectedInvoiceForPrint,
        setSelectedInvoiceForPrint,
        quickNotification,
        showToast,
        resetAllToDefault
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) throw new Error('useBilling must be used within a BillingProvider');
  return context;
};
