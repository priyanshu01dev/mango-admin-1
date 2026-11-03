import { ApiEndpointSpec } from '../types';

// Reference examples shown in the API explorer (not app data)
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
