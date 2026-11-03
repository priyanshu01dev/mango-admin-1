import {
  BusinessProfile,
  Invoice,
  Quotation,
  Product,
  Party,
  PaymentTransaction,
  EWayBillRecord,
  EInvoiceRecord,
  SubscriptionPlan,
  AuditLog,
  ApiEndpointSpec
} from '../types';

export const INITIAL_BUSINESSES: BusinessProfile[] = [
  {
    id: 'biz-1',
    name: 'Sharma Electronics & Electricals Ltd',
    tradeName: 'Sharma Mega Store',
    gstin: '07AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    email: 'billing@sharmaelectronics.in',
    phone: '+91 98110 23456',
    address: 'Shop 14-16, Nehru Place Commercial Complex',
    city: 'New Delhi',
    state: 'Delhi',
    stateCode: '07',
    pincode: '110019',
    bankName: 'HDFC Bank',
    bankAccountNumber: '50200012345678',
    bankIfsc: 'HDFC0000128',
    bankBranch: 'Nehru Place, New Delhi',
    upiId: 'sharmaelectronics@hdfcbank',
    signatureText: 'For Sharma Electronics & Electricals Ltd',
    terms: '1. Goods once sold will not be taken back without original bill. 2. Interest @ 18% p.a. will be charged if payment is delayed beyond 15 days.',
    activePlan: 'ENTERPRISE',
    planValidUntil: '2027-03-31',
    status: 'ACTIVE'
  },
  {
    id: 'biz-2',
    name: 'Rajdhani FMCG & Kirana Traders',
    tradeName: 'Rajdhani Super Bazar',
    gstin: '08BBBBB1111B2Z4',
    pan: 'BBBBB1111B',
    email: 'accounts@rajdhanikirana.com',
    phone: '+91 94140 88776',
    address: 'Plot 42, Krishi Upaj Mandi, M.I. Road',
    city: 'Jaipur',
    state: 'Rajasthan',
    stateCode: '08',
    pincode: '302001',
    bankName: 'State Bank of India',
    bankAccountNumber: '38192004921',
    bankIfsc: 'SBIN0004120',
    bankBranch: 'M.I. Road, Jaipur',
    upiId: 'rajdhanifmcg@sbi',
    signatureText: 'For Rajdhani FMCG & Kirana Traders',
    terms: '1. Subject to Jaipur jurisdiction only. 2. Please verify goods at delivery.',
    activePlan: 'GROWTH',
    planValidUntil: '2026-12-31',
    status: 'ACTIVE'
  },
  {
    id: 'biz-3',
    name: 'Bharat Tex Fab & Garments',
    tradeName: 'Bharat Apparels',
    gstin: '24CCCCC2222C3Z3',
    pan: 'CCCCC2222C',
    email: 'info@bharattextiles.com',
    phone: '+91 98250 44332',
    address: 'Ring Road Textile Market, Surat',
    city: 'Surat',
    state: 'Gujarat',
    stateCode: '24',
    pincode: '395002',
    bankName: 'ICICI Bank',
    bankAccountNumber: '001205011928',
    bankIfsc: 'ICIC0000012',
    bankBranch: 'Ring Road, Surat',
    upiId: 'bharattex@icici',
    signatureText: 'For Bharat Tex Fab & Garments',
    terms: '1. All disputes subject to Surat jurisdiction. 2. E-Way bill must accompany transport.',
    activePlan: 'STARTER',
    planValidUntil: '2026-11-30',
    status: 'ACTIVE'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    businessId: 'biz-1',
    name: 'Havells 1.5 Sq mm Copper Wire (90m Roll)',
    sku: 'EL-WIR-001',
    hsnCode: '8544',
    category: 'Electricals',
    unit: 'ROLL',
    purchasePrice: 1450,
    sellingPrice: 1850,
    taxRate: 18,
    currentStock: 48,
    minStockAlert: 15,
    status: 'ACTIVE'
  },
  {
    id: 'prod-2',
    businessId: 'biz-1',
    name: 'Schneider 16A Modular Switch (White)',
    sku: 'EL-SW-16A',
    hsnCode: '8536',
    category: 'Electricals',
    unit: 'PCS',
    purchasePrice: 95,
    sellingPrice: 140,
    taxRate: 18,
    currentStock: 320,
    minStockAlert: 50,
    status: 'ACTIVE'
  },
  {
    id: 'prod-3',
    businessId: 'biz-1',
    name: 'Philips 20W LED Batten Light (Cool Day)',
    sku: 'LGT-LED-20W',
    hsnCode: '9405',
    category: 'Lighting',
    unit: 'PCS',
    purchasePrice: 220,
    sellingPrice: 350,
    taxRate: 12,
    currentStock: 12, // Low stock alert!
    minStockAlert: 20,
    status: 'ACTIVE'
  },
  {
    id: 'prod-4',
    businessId: 'biz-1',
    name: 'Crompton 1200mm Ceiling Fan (High Speed)',
    sku: 'APP-FAN-1200',
    hsnCode: '8414',
    category: 'Appliances',
    unit: 'PCS',
    purchasePrice: 1650,
    sellingPrice: 2299,
    taxRate: 18,
    currentStock: 8, // Low stock alert!
    minStockAlert: 10,
    status: 'ACTIVE'
  },
  {
    id: 'prod-5',
    businessId: 'biz-1',
    name: 'Luminous 1100VA Pure Sine Wave Inverter',
    sku: 'PWR-INV-1100',
    hsnCode: '8504',
    category: 'Power Backup',
    unit: 'PCS',
    purchasePrice: 5200,
    sellingPrice: 6800,
    taxRate: 18,
    currentStock: 16,
    minStockAlert: 5,
    status: 'ACTIVE'
  },
  {
    id: 'prod-6',
    businessId: 'biz-1',
    name: 'Anchor 32A Double Pole MCB Isolator',
    sku: 'EL-MCB-32A',
    hsnCode: '8536',
    category: 'Electricals',
    unit: 'PCS',
    purchasePrice: 280,
    sellingPrice: 420,
    taxRate: 18,
    currentStock: 64,
    minStockAlert: 15,
    status: 'ACTIVE'
  }
];

export const INITIAL_PARTIES: Party[] = [
  {
    id: 'party-1',
    businessId: 'biz-1',
    type: 'CUSTOMER',
    name: 'Apex Infotech Solutions Pvt Ltd',
    contactPerson: 'Vikram Malhotra',
    phone: '+91 98101 99221',
    email: 'procurement@apexinfotech.com',
    gstin: '07AAPCA9999P1ZA',
    billingAddress: 'Tower B, DLF Cyber City, Phase 2, Gurugram / Delhi Office',
    state: 'Delhi',
    stateCode: '07', // Intra-state (CGST + SGST)
    openingBalance: 0,
    currentBalance: 48500, // Receivable
    creditLimit: 200000,
    status: 'ACTIVE'
  },
  {
    id: 'party-2',
    businessId: 'biz-1',
    type: 'CUSTOMER',
    name: 'Sunrise Buildcon & Contractors',
    contactPerson: 'Anand Chauhan',
    phone: '+91 99580 11447',
    email: 'billing@sunrisebuildcon.org',
    gstin: '09AAECS8888E1Z9',
    billingAddress: 'Sector 62, Noida, Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    stateCode: '09', // Inter-state (IGST)
    openingBalance: 15000,
    currentBalance: 82600, // Receivable
    creditLimit: 300000,
    status: 'ACTIVE'
  },
  {
    id: 'party-3',
    businessId: 'biz-1',
    type: 'CUSTOMER',
    name: 'Gupta Hardware & Sanitary Store',
    contactPerson: 'Rajesh Gupta',
    phone: '+91 98711 55660',
    email: 'guptahardware@gmail.com',
    gstin: '07BCDPG4444G1Z2',
    billingAddress: 'Main Market, Lajpat Nagar 4, New Delhi',
    state: 'Delhi',
    stateCode: '07',
    openingBalance: 0,
    currentBalance: 0,
    creditLimit: 100000,
    status: 'ACTIVE'
  },
  {
    id: 'party-4',
    businessId: 'biz-1',
    type: 'SUPPLIER',
    name: 'Havells India Authorized Distributor',
    contactPerson: 'Deepak Saxena',
    phone: '+91 98188 33221',
    email: 'orders@havellsdistributor.com',
    gstin: '07AAACH0001H1Z0',
    billingAddress: 'Bhagirath Palace, Chandni Chowk, Delhi',
    state: 'Delhi',
    stateCode: '07',
    openingBalance: 0,
    currentBalance: -65000, // Payable
    status: 'ACTIVE'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-101',
    invoiceNumber: 'INV/2026/00142',
    businessId: 'biz-1',
    customerId: 'party-1',
    customerName: 'Apex Infotech Solutions Pvt Ltd',
    customerGstin: '07AAPCA9999P1ZA',
    customerPhone: '+91 98101 99221',
    customerAddress: 'Tower B, DLF Cyber City, Delhi Office',
    customerStateCode: '07',
    invoiceDate: '2026-11-01',
    dueDate: '2026-11-15',
    isInterState: false, // Delhi to Delhi => CGST + SGST
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        name: 'Havells 1.5 Sq mm Copper Wire (90m Roll)',
        hsnCode: '8544',
        quantity: 10,
        unit: 'ROLL',
        price: 1850,
        discountPercent: 5,
        gstRate: 18,
        taxableAmount: 17575,
        cgstAmount: 1581.75,
        sgstAmount: 1581.75,
        igstAmount: 0,
        totalAmount: 20738.5
      },
      {
        id: 'item-2',
        productId: 'prod-4',
        name: 'Crompton 1200mm Ceiling Fan (High Speed)',
        hsnCode: '8414',
        quantity: 6,
        unit: 'PCS',
        price: 2299,
        discountPercent: 0,
        gstRate: 18,
        taxableAmount: 13794,
        cgstAmount: 1241.46,
        sgstAmount: 1241.46,
        igstAmount: 0,
        totalAmount: 16276.92
      }
    ],
    subTotal: 32294,
    totalDiscount: 925,
    taxableTotal: 31369,
    cgstTotal: 2823.21,
    sgstTotal: 2823.21,
    igstTotal: 0,
    totalGst: 5646.42,
    roundOff: 0.58,
    grandTotal: 37016,
    amountPaid: 37016,
    balanceDue: 0,
    status: 'PAID',
    notes: 'Thank you for your business. Payment received via UPI transaction.',
    eInvoiceStatus: 'GENERATED',
    irnNumber: '9f8b4a2d1e0c3f5b7a9c8d6e4b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a',
    eWayBillStatus: 'NOT_GENERATED',
    createdAt: '2026-11-01T10:30:00Z'
  },
  {
    id: 'inv-102',
    invoiceNumber: 'INV/2026/00143',
    businessId: 'biz-1',
    customerId: 'party-2',
    customerName: 'Sunrise Buildcon & Contractors',
    customerGstin: '09AAECS8888E1Z9',
    customerPhone: '+91 99580 11447',
    customerAddress: 'Sector 62, Noida, Uttar Pradesh',
    customerStateCode: '09',
    invoiceDate: '2026-11-02',
    dueDate: '2026-11-17',
    isInterState: true, // Delhi to UP => IGST
    items: [
      {
        id: 'item-3',
        productId: 'prod-5',
        name: 'Luminous 1100VA Pure Sine Wave Inverter',
        hsnCode: '8504',
        quantity: 10,
        unit: 'PCS',
        price: 6800,
        discountPercent: 2,
        gstRate: 18,
        taxableAmount: 66640,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 11995.2,
        totalAmount: 78635.2
      },
      {
        id: 'item-4',
        productId: 'prod-2',
        name: 'Schneider 16A Modular Switch (White)',
        hsnCode: '8536',
        quantity: 100,
        unit: 'PCS',
        price: 140,
        discountPercent: 10,
        gstRate: 18,
        taxableAmount: 12600,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 2268,
        totalAmount: 14868
      }
    ],
    subTotal: 82000,
    totalDiscount: 2760,
    taxableTotal: 79240,
    cgstTotal: 0,
    sgstTotal: 0,
    igstTotal: 14263.2,
    totalGst: 14263.2,
    roundOff: 0.80,
    grandTotal: 93504,
    amountPaid: 30000,
    balanceDue: 63504,
    status: 'PARTIALLY_PAID',
    notes: 'Urgent site delivery. Balance payable within 15 days.',
    eInvoiceStatus: 'GENERATED',
    irnNumber: '4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a9f8b4a2d1e0c3f5b7a9c8d',
    eWayBillStatus: 'GENERATED',
    eWayBillNumber: '241098451234',
    createdAt: '2026-11-02T14:15:00Z'
  },
  {
    id: 'inv-103',
    invoiceNumber: 'INV/2026/00144',
    businessId: 'biz-1',
    customerId: 'party-3',
    customerName: 'Gupta Hardware & Sanitary Store',
    customerGstin: '07BCDPG4444G1Z2',
    customerPhone: '+91 98711 55660',
    customerAddress: 'Main Market, Lajpat Nagar 4, New Delhi',
    customerStateCode: '07',
    invoiceDate: '2026-10-25',
    dueDate: '2026-11-05',
    isInterState: false,
    items: [
      {
        id: 'item-5',
        productId: 'prod-6',
        name: 'Anchor 32A Double Pole MCB Isolator',
        hsnCode: '8536',
        quantity: 30,
        unit: 'PCS',
        price: 420,
        discountPercent: 5,
        gstRate: 18,
        taxableAmount: 11970,
        cgstAmount: 1077.3,
        sgstAmount: 1077.3,
        igstAmount: 0,
        totalAmount: 14124.6
      }
    ],
    subTotal: 12600,
    totalDiscount: 630,
    taxableTotal: 11970,
    cgstTotal: 1077.3,
    sgstTotal: 1077.3,
    igstTotal: 0,
    totalGst: 2154.6,
    roundOff: 0.40,
    grandTotal: 14125,
    amountPaid: 0,
    balanceDue: 14125,
    status: 'UNPAID',
    notes: 'Credit terms 10 days. Reminder dispatched.',
    eInvoiceStatus: 'NOT_GENERATED',
    eWayBillStatus: 'NOT_GENERATED',
    createdAt: '2026-10-25T11:00:00Z'
  }
];

export const INITIAL_QUOTATIONS: Quotation[] = [
  {
    id: 'quot-201',
    quotationNumber: 'EST/2026/00088',
    businessId: 'biz-1',
    customerId: 'party-2',
    customerName: 'Sunrise Buildcon & Contractors',
    customerGstin: '09AAECS8888E1Z9',
    customerPhone: '+91 99580 11447',
    customerAddress: 'Sector 62, Noida, Uttar Pradesh',
    customerStateCode: '09',
    date: '2026-11-02',
    validUntil: '2026-11-16',
    isInterState: true,
    items: [
      {
        id: 'q-item-1',
        productId: 'prod-3',
        name: 'Philips 20W LED Batten Light (Cool Day)',
        hsnCode: '9405',
        quantity: 50,
        unit: 'PCS',
        price: 330,
        discountPercent: 5,
        gstRate: 12,
        taxableAmount: 15675,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 1881,
        totalAmount: 17556
      }
    ],
    grandTotal: 17556,
    status: 'SENT',
    notes: 'Quotation valid for 14 days from issue date. Special contractor discount applied.'
  }
];

export const INITIAL_PAYMENTS: PaymentTransaction[] = [
  {
    id: 'pay-001',
    businessId: 'biz-1',
    type: 'PAYMENT_IN',
    partyId: 'party-1',
    partyName: 'Apex Infotech Solutions Pvt Ltd',
    invoiceId: 'inv-101',
    invoiceNumber: 'INV/2026/00142',
    amount: 37016,
    paymentDate: '2026-11-01',
    mode: 'UPI',
    referenceNumber: 'UPI/430812994401',
    notes: 'Full payment received through PhonePe QR scan'
  },
  {
    id: 'pay-002',
    businessId: 'biz-1',
    type: 'PAYMENT_IN',
    partyId: 'party-2',
    partyName: 'Sunrise Buildcon & Contractors',
    invoiceId: 'inv-102',
    invoiceNumber: 'INV/2026/00143',
    amount: 30000,
    paymentDate: '2026-11-02',
    mode: 'NEFT_RTGS',
    referenceNumber: 'NEFT-HDFC2630600192',
    notes: 'Advance 32% transfer for Noida commercial wiring job'
  }
];

export const INITIAL_EWAY_BILLS: EWayBillRecord[] = [
  {
    id: 'ewb-01',
    ewbNumber: '241098451234',
    invoiceNumber: 'INV/2026/00143',
    invoiceId: 'inv-102',
    fromGstin: '07AAAAA0000A1Z5',
    toGstin: '09AAECS8888E1Z9',
    transporterName: 'VRL Logistics Ltd',
    transporterId: '29AABCV1234L1Z8',
    vehicleNumber: 'DL 1L AA 4590',
    approxDistanceKm: 42,
    supplyType: 'Outward',
    documentType: 'Tax Invoice',
    generatedDate: '2026-11-02 14:30',
    validUpto: '2026-11-04 23:59',
    status: 'ACTIVE'
  }
];

export const INITIAL_E_INVOICES: EInvoiceRecord[] = [
  {
    id: 'einv-01',
    irn: '9f8b4a2d1e0c3f5b7a9c8d6e4b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a',
    ackNo: '1126100984512',
    ackDate: '2026-11-01 10:32:15',
    invoiceNumber: 'INV/2026/00142',
    invoiceId: 'inv-101',
    buyerGstin: '07AAPCA9999P1ZA',
    totalValue: 37016,
    status: 'ACTIVE',
    signedQrCodePayload: 'GSTIN07AAAAA0000A1Z5:INV/2026/00142:37016:9f8b4a2d1e0c'
  },
  {
    id: 'einv-02',
    irn: '4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a9f8b4a2d1e0c3f5b7a9c8d',
    ackNo: '1126100984990',
    ackDate: '2026-11-02 14:18:22',
    invoiceNumber: 'INV/2026/00143',
    invoiceId: 'inv-102',
    buyerGstin: '09AAECS8888E1Z9',
    totalValue: 93504,
    status: 'ACTIVE',
    signedQrCodePayload: 'GSTIN07AAAAA0000A1Z5:INV/2026/00143:93504:4c3b2a1f0e9d'
  }
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-free',
    name: 'Free Trial',
    priceMonthly: 0,
    priceYearly: 0,
    invoiceLimit: 50,
    eWayBillLimit: 5,
    multiUserLimit: 1,
    features: ['Up to 50 GST Invoices/mo', 'Basic PDF templates', '1 Business profile', 'Customer directory', 'Basic Sales report'],
    activeUsersCount: 1420
  },
  {
    id: 'plan-silver',
    name: 'Starter Pro',
    priceMonthly: 399,
    priceYearly: 3999,
    invoiceLimit: 500,
    eWayBillLimit: 50,
    multiUserLimit: 2,
    features: ['500 GST Invoices/mo', 'E-Way bill & E-Invoice generation', 'WhatsApp invoice sharing', 'Payment reminders', 'Inventory & low-stock alerts'],
    activeUsersCount: 3840,
    badge: 'Popular for Retail'
  },
  {
    id: 'plan-gold',
    name: 'Growth Business',
    priceMonthly: 799,
    priceYearly: 7999,
    invoiceLimit: 'Unlimited',
    eWayBillLimit: 200,
    multiUserLimit: 5,
    features: ['Unlimited GST Invoices', 'Full GSTR-1 & GSTR-3B filing reports', 'E-Way Bill & E-Invoice with IRN', 'Multi-device Android app sync', 'Dedicated account manager'],
    activeUsersCount: 5290,
    badge: 'Best Value'
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise / CA Suite',
    priceMonthly: 1499,
    priceYearly: 14999,
    invoiceLimit: 'Unlimited',
    eWayBillLimit: 'Unlimited',
    multiUserLimit: 15,
    features: ['Unlimited Everything', 'Multi-tenant branch management', 'Custom invoice branding & watermarks', 'Direct Android REST API access & Webhooks', 'Priority 24/7 CA helpline'],
    activeUsersCount: 980
  }
];

export const AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    timestamp: '2026-11-03 09:14:22',
    userName: 'Admin (Priyanshu)',
    role: 'Super Admin',
    ipAddress: '103.212.144.18',
    action: 'INVOICE_CREATE',
    details: 'Generated GST Tax Invoice INV/2026/00143 for ₹93,504.00 (IGST)',
    status: 'SUCCESS'
  },
  {
    id: 'log-2',
    timestamp: '2026-11-03 08:45:10',
    userName: 'Rajesh K (Billing Staff)',
    role: 'Billing Manager',
    ipAddress: '103.212.144.20',
    action: 'EWAY_GENERATE',
    details: 'Generated E-Way Bill 241098451234 for vehicle DL 1L AA 4590',
    status: 'SUCCESS'
  },
  {
    id: 'log-3',
    timestamp: '2026-11-03 07:30:04',
    userName: 'System Cron',
    role: 'System',
    ipAddress: '127.0.0.1',
    action: 'STOCK_ALERT',
    details: 'Low stock notification triggered for Philips 20W LED Batten Light (12 PCS remaining)',
    status: 'WARNING'
  },
  {
    id: 'log-4',
    timestamp: '2026-11-02 18:20:11',
    userName: 'Sunita M (Accountant)',
    role: 'Accountant',
    ipAddress: '103.212.144.55',
    action: 'PAYMENT_RECORD',
    details: 'Recorded NEFT Payment of ₹30,000 for INV/2026/00143',
    status: 'SUCCESS'
  }
];

export const ANDROID_API_ENDPOINTS: ApiEndpointSpec[] = [
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    category: 'Auth',
    description: 'Authenticate Android billing app user and issue JWT bearer token',
    headers: { 'Content-Type': 'application/json' },
    requestBodySample: {
      phone: '+919811023456',
      pinOrPassword: '••••••',
      deviceId: 'android_samsung_s24_98fbc',
      appVersion: '3.4.2'
    },
    responseSample: {
      status: 'success',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.gimbooks_android_auth_sample_payload',
      expiresIn: 2592000,
      user: {
        id: 'usr_8821',
        name: 'Priyanshu Kumar',
        phone: '+919811023456',
        role: 'OWNER',
        businessId: 'biz-1',
        businessName: 'Sharma Electronics & Electricals Ltd'
      }
    }
  },
  {
    method: 'GET',
    path: '/api/v1/invoices',
    category: 'Invoices',
    description: 'Fetch paginated list of GST invoices with filters for date range and payment status',
    headers: { 'Authorization': 'Bearer <JWT_TOKEN>' },
    responseSample: {
      status: 'success',
      totalCount: 144,
      page: 1,
      limit: 20,
      data: [
        {
          id: 'inv-101',
          invoiceNumber: 'INV/2026/00142',
          customerName: 'Apex Infotech Solutions Pvt Ltd',
          invoiceDate: '2026-11-01',
          grandTotal: 37016,
          status: 'PAID',
          eInvoiceStatus: 'GENERATED'
        }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/v1/invoices',
    category: 'Invoices',
    description: 'Create a new GST Tax Invoice with automatic tax split (CGST+SGST vs IGST) and inventory deduction',
    headers: { 'Authorization': 'Bearer <JWT_TOKEN>', 'Content-Type': 'application/json' },
    requestBodySample: {
      customerId: 'party-1',
      invoiceDate: '2026-11-03',
      dueDate: '2026-11-18',
      items: [
        {
          productId: 'prod-1',
          quantity: 5,
          unit: 'ROLL',
          price: 1850,
          discountPercent: 5,
          gstRate: 18
        }
      ],
      notes: 'Delivered via local van'
    },
    responseSample: {
      status: 'success',
      message: 'Invoice generated successfully',
      invoiceId: 'inv-104',
      invoiceNumber: 'INV/2026/00145',
      taxableTotal: 8787.5,
      cgstTotal: 790.88,
      sgstTotal: 790.88,
      grandTotal: 10369,
      pdfUrl: 'https://cdn.gimbooks.internal/invoices/INV_2026_00145.pdf'
    }
  },
  {
    method: 'GET',
    path: '/api/v1/inventory',
    category: 'Inventory',
    description: 'Get real-time product stock, purchase rate, sale rate and low-stock warning indicators',
    headers: { 'Authorization': 'Bearer <JWT_TOKEN>' },
    responseSample: {
      status: 'success',
      totalProducts: 6,
      lowStockCount: 2,
      products: [
        {
          id: 'prod-1',
          name: 'Havells 1.5 Sq mm Copper Wire (90m Roll)',
          sku: 'EL-WIR-001',
          hsnCode: '8544',
          currentStock: 48,
          sellingPrice: 1850,
          isLowStock: false
        }
      ]
    }
  },
  {
    method: 'POST',
    path: '/api/v1/eway-bill/generate',
    category: 'GST & E-Way',
    description: 'NIC GST Portal E-Way Bill generation API wrapper with Transporter ID and vehicle number',
    headers: { 'Authorization': 'Bearer <JWT_TOKEN>', 'Content-Type': 'application/json' },
    requestBodySample: {
      invoiceId: 'inv-102',
      transporterName: 'VRL Logistics Ltd',
      transporterId: '29AABCV1234L1Z8',
      vehicleNumber: 'DL 1L AA 4590',
      approxDistanceKm: 42
    },
    responseSample: {
      status: 'success',
      ewbNumber: '241098451234',
      validUpto: '2026-11-04 23:59',
      qrCodeData: 'EWB:241098451234|DL1LAA4590|07AAAAA0000A1Z5'
    }
  },
  {
    method: 'POST',
    path: '/api/v1/payments',
    category: 'Payments',
    description: 'Record Payment In or Payment Out with instant customer ledger credit/debit adjustment',
    headers: { 'Authorization': 'Bearer <JWT_TOKEN>', 'Content-Type': 'application/json' },
    requestBodySample: {
      type: 'PAYMENT_IN',
      partyId: 'party-2',
      invoiceId: 'inv-102',
      amount: 15000,
      mode: 'UPI',
      referenceNumber: 'UPI/43089912001',
      notes: 'Part payment received'
    },
    responseSample: {
      status: 'success',
      paymentId: 'pay-003',
      newPartyBalance: 48504,
      receiptNumber: 'RCPT-2026-0091'
    }
  }
];
