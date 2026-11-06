export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh'
};

export function getStateNameByCode(code: string): string {
  return INDIAN_STATES[code] || `State (${code})`;
}

export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === undefined || amount === null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

// Convert numbers to Indian Rupees in words
export function numberToWordsINR(amount: number): string {
  const roundAmount = Math.round(amount * 100) / 100;
  const parts = roundAmount.toString().split('.');
  const wholePart = parseInt(parts[0], 10);
  const decimalPart = parts[1] ? parseInt(parts[1].padEnd(2, '0').slice(0, 2), 10) : 0;

  if (isNaN(wholePart)) return 'Zero Rupees Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 20) return units[n];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit ? ' ' + units[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = '';
    if (hundred > 0) {
      res += units[hundred] + ' Hundred';
      if (rest > 0) res += ' ';
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  if (wholePart === 0 && decimalPart === 0) return 'Zero Rupees Only';

  let words = '';
  let rem = wholePart;

  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  const hundredAndRest = rem;

  if (crore > 0) words += convertTwoDigits(crore) + ' Crore ';
  if (lakh > 0) words += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) words += convertTwoDigits(thousand) + ' Thousand ';
  if (hundredAndRest > 0) words += convertThreeDigits(hundredAndRest) + ' ';

  words = words.trim() + ' Rupees';

  if (decimalPart > 0) {
    words += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }

  return words + ' Only';
}

// Translations dictionary for bilingual Hindi & English UI
export const TRANSLATIONS = {
  en: {
    appName: 'Mango Invoice',
    tagline: 'GST Billing, Invoicing & Admin Suite',
    dashboard: 'Dashboard',
    invoices: 'Invoices & Billing',
    quotations: 'Quotations / Estimates',
    eWayEInvoice: 'E-Way & E-Invoice',
    inventory: 'Inventory & Stock',
    parties: 'Customers & Suppliers',
    payments: 'Payments & Receipts',
    gstReports: 'GST Reports & Filing',
    subscriptions: 'Subscriptions & SaaS',
    androidApi: 'Android REST API',
    auditLogs: 'Audit & Settings',
    staffAttendance: 'Staff & Attendance',
    adminStaff: 'Staff (Admins)',
    totalRevenue: 'Total Revenue',
    totalUsers: 'Total Businesses',
    activeInvoices: 'Invoices Generated',
    pendingReceivables: 'Pending Receivables',
    gstCollected: 'Total GST Collected',
    createNewInvoice: 'New Invoice',
    addProduct: 'Add Product',
    createQuotation: 'New Quotation',
    generateEWayBill: 'Generate E-Way Bill',
    generateEInvoice: 'Generate E-Invoice',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partiallyPaid: 'Partially Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    action: 'Action',
    status: 'Status',
    searchPlaceholder: 'Search invoice, customer, GSTIN or SKU...',
    printPdf: 'Print Tax Invoice / PDF',
    downloadPdf: 'Download PDF',
    shareWhatsapp: 'Share via WhatsApp',
    convertInvoice: 'Convert to Invoice',
    markAsPaid: 'Record Payment',
    lowStockAlerts: 'Low Stock Alerts',
    recentTransactions: 'Recent Billing Transactions',
    monthlySalesTrend: 'Sales & GST Trends (last 6 months)',
    exportData: 'Export Data',
    gstinLabel: 'GSTIN',
    stateLabel: 'State',
    hsnLabel: 'HSN / SAC',
    taxBreakup: 'Tax Breakdown',
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    taxableValue: 'Taxable Amount',
    grandTotal: 'Grand Total'
  },
  hi: {
    appName: 'मैंगो इनवॉइस',
    tagline: 'जीएसटी बिलिंग, इनवॉइसिंग व एडमिन सूट',
    dashboard: 'डैशबोर्ड (Overview)',
    invoices: 'बिल व इनवॉइस (Invoices)',
    quotations: 'कोटेशन / एस्टिमेट',
    eWayEInvoice: 'ई-वे बिल व ई-इनवॉइस',
    inventory: 'इन्वेंटरी व स्टॉक नियंत्रण',
    parties: 'ग्राहक व सप्लायर (Parties)',
    payments: 'पेमेंट्स व रसीदें',
    gstReports: 'GST रिपोर्ट्स व टैक्स फाइलिंग',
    subscriptions: 'सब्सक्रिप्शन व प्लान्स',
    androidApi: 'एंड्रॉइड ऐप REST API',
    auditLogs: 'ऑडिट लॉग व सेटिंग्स',
    staffAttendance: 'स्टाफ व हाज़िरी',
    adminStaff: 'स्टाफ (एडमिन)',
    totalRevenue: 'कुल बिक्री (राजस्व)',
    totalUsers: 'कुल रजिस्टर्ड बिजनेस',
    activeInvoices: 'कुल जारी इनवॉइस',
    pendingReceivables: 'कुल बकाया राशि',
    gstCollected: 'कुल एकत्रित GST',
    createNewInvoice: '+ नया GST बिल बनाएं',
    addProduct: '+ नया प्रोडक्ट जोड़ें',
    createQuotation: '+ नया कोटेशन बनाएं',
    generateEWayBill: 'ई-वे बिल जनरेट करें',
    generateEInvoice: 'ई-इनवॉइस बनाएं (IRN)',
    paid: 'भुगतान हो चुका (Paid)',
    unpaid: 'बकाया (Unpaid)',
    partiallyPaid: 'आंशिक भुगतान',
    overdue: 'अतिदेय (Overdue)',
    cancelled: 'रद्द (Cancelled)',
    action: 'कार्यवाही',
    status: 'स्थिति',
    searchPlaceholder: 'इनवॉइस नंबर, ग्राहक, GSTIN या SKU खोजें...',
    printPdf: 'प्रिंट टैक्स इनवॉइस / PDF',
    downloadPdf: 'PDF डाउनलोड करें',
    shareWhatsapp: 'व्हाट्सएप पर भेजें',
    convertInvoice: 'बिल में बदलें',
    markAsPaid: 'पेमेंट दर्ज करें',
    lowStockAlerts: 'कम स्टॉक वाले प्रोडक्ट्स',
    recentTransactions: 'हाल के बिलिंग ट्रांजैक्शन',
    monthlySalesTrend: 'मासिक बिक्री व GST ट्रेंड',
    exportData: 'डेटा एक्सपोर्ट करें',
    gstinLabel: 'GSTIN नंबर',
    stateLabel: 'राज्य (State)',
    hsnLabel: 'HSN / SAC कोड',
    taxBreakup: 'टैक्स विवरण (Tax Breakup)',
    cgst: 'केंद्रीय कर (CGST)',
    sgst: 'राज्य कर (SGST)',
    igst: 'एकीकृत कर (IGST)',
    taxableValue: 'कर योग्य राशि (Taxable)',
    grandTotal: 'कुल देय राशि (Grand Total)'
  }
};
