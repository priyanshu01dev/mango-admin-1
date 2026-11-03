import {
  PlanConfig,
  Merchant,
  SubscriptionRecord,
  Coupon,
  AddOn,
  SupportTicket,
  FeatureFlag,
  Broadcast,
  Integration,
  ComplianceRules,
  DailyMetric,
  RetentionCohort,
  PlanId,
  BillingCycle,
  MerchantStatus,
  ClientPlatform
} from '../types/admin';

// "Today" for the demo dataset
export const ADMIN_TODAY = '2026-11-04';

// Brand-aligned, CVD-validated plan colours (validator: all checks PASS on light surface)
export const PLAN_COLORS: Record<PlanId, string> = {
  free: '#3e9b2f', // leaf
  silver: '#1a5ba6', // First Wave blue
  gold: '#e25e0e', // mango
  platinum: '#7c5cd6' // violet
};

export const GST_ON_SUBSCRIPTION = 18;

// Spec §10 — suggested packaging
export const INITIAL_PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Unlimited GST invoices on mobile',
    priceYearly: 0,
    price2Years: 0,
    price3Years: 0,
    priceLifetime: 0,
    limits: { invoicesPerMonth: null, users: 1, businesses: 1, eWayBillsPerYear: 0, eInvoicesPerYear: 0 },
    features: ['Unlimited GST invoices (mobile)', '1 user', 'Basic reports', 'WhatsApp / PDF sharing'],
    watermark: true,
    isActive: true
  },
  {
    id: 'silver',
    name: 'Silver',
    tagline: 'For retail shops going digital',
    priceYearly: 1999,
    price2Years: 3499,
    price3Years: 4799,
    priceLifetime: 9999,
    limits: { invoicesPerMonth: null, users: 1, businesses: 1, eWayBillsPerYear: 0, eInvoicesPerYear: 0 },
    features: ['No watermark', 'Web dashboard access', 'All 25+ document types', 'Payment reminders', 'GSTR-1 / 3B reports'],
    watermark: false,
    highlight: 'Popular',
    isActive: true
  },
  {
    id: 'gold',
    name: 'Gold',
    tagline: 'Traders, wholesalers & distributors',
    priceYearly: 3999,
    price2Years: 6999,
    price3Years: 9499,
    priceLifetime: 17999,
    limits: { invoicesPerMonth: null, users: 3, businesses: 1, eWayBillsPerYear: 600, eInvoicesPerYear: 0 },
    features: ['Everything in Silver', 'e-Way bill', '3 users', 'Batch / godown / barcode inventory', 'Thermal POS billing', 'Tally export'],
    watermark: false,
    highlight: 'Best value',
    isActive: true
  },
  {
    id: 'platinum',
    name: 'Platinum',
    tagline: 'e-Invoice ready businesses (AATO > ₹5 Cr)',
    priceYearly: 6999,
    price2Years: 12499,
    price3Years: 16999,
    priceLifetime: 29999,
    limits: { invoicesPerMonth: null, users: 10, businesses: 5, eWayBillsPerYear: null, eInvoicesPerYear: 3000 },
    features: ['Everything in Gold', 'e-Invoice (IRN + QR)', 'Bulk IRN generation', 'Multi-business', 'Public API access', 'Priority call + WhatsApp support'],
    watermark: false,
    isActive: true
  }
];

export const INITIAL_ADDONS: AddOn[] = [
  { id: 'addon-user', name: 'Extra user login', description: 'Add one staff / CA login to any paid plan', price: 499, unit: 'per user / year', active: true, soldThisMonth: 86 },
  { id: 'addon-wa', name: 'WhatsApp message pack', description: '1,000 template messages (invoice + reminders)', price: 699, unit: 'per 1,000 msgs', active: true, soldThisMonth: 142 },
  { id: 'addon-einv', name: 'e-Invoice call pack', description: '500 additional IRN generations', price: 999, unit: 'per 500 IRNs', active: true, soldThisMonth: 23 },
  { id: 'addon-ewb', name: 'e-Way bill call pack', description: '250 additional e-way bills', price: 599, unit: 'per 250 EWBs', active: true, soldThisMonth: 37 },
  { id: 'addon-filing', name: 'Assisted GST filing', description: 'In-house CA files GSTR-1 / 3B for the merchant', price: 499, unit: 'per return', active: true, soldThisMonth: 211 },
  { id: 'addon-biz', name: 'Additional business', description: 'Manage one more GSTIN under the same login', price: 1499, unit: 'per business / year', active: false, soldThisMonth: 0 }
];

export const INITIAL_COUPONS: Coupon[] = [
  { id: 'cpn-1', code: 'DIWALI26', type: 'PERCENT', value: 30, appliesTo: ['silver', 'gold', 'platinum'], maxRedemptions: 2000, redeemed: 1284, validUntil: '2026-11-15', active: true, description: 'Diwali festive offer' },
  { id: 'cpn-2', code: 'CAPARTNER', type: 'PERCENT', value: 20, appliesTo: ['gold', 'platinum'], maxRedemptions: 5000, redeemed: 642, validUntil: '2027-03-31', active: true, description: 'CA / reseller partner referral' },
  { id: 'cpn-3', code: 'FIRST500', type: 'FLAT', value: 500, appliesTo: ['gold', 'platinum'], maxRedemptions: 1000, redeemed: 1000, validUntil: '2026-12-31', active: false, description: 'Launch offer — exhausted' },
  { id: 'cpn-4', code: 'SWITCH2MANGO', type: 'PERCENT', value: 40, appliesTo: ['silver', 'gold'], maxRedemptions: 1500, redeemed: 318, validUntil: '2027-01-31', active: true, description: 'Switching from another billing app' }
];

// ---------- deterministic generators ----------
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seeded(42);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const addDays = (iso: string, d: number) => {
  const dt = new Date(iso + 'T00:00:00');
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
};

const MERCHANT_SEED: [string, string, string, string, string, string][] = [
  // business, owner, city, state, stateCode, industry
  ['Shree Balaji Traders', 'Ramesh Agarwal', 'Raipur', 'Chhattisgarh', '22', 'Wholesale / Distribution'],
  ['Gupta Electronics & Mobiles', 'Ankit Gupta', 'Lucknow', 'Uttar Pradesh', '09', 'Electronics & Mobile'],
  ['Kaveri Textiles', 'Lakshmi Narayan', 'Coimbatore', 'Tamil Nadu', '33', 'Textile'],
  ['Om Sai Hardware', 'Prakash Patil', 'Pune', 'Maharashtra', '27', 'Hardware'],
  ['Sunrise Pharma Distributors', 'Dr. Meera Shah', 'Ahmedabad', 'Gujarat', '24', 'Pharma'],
  ['Royal Jewellers', 'Vikram Soni', 'Jaipur', 'Rajasthan', '08', 'Jewellery'],
  ['Fresh Basket Kirana', 'Suresh Yadav', 'Patna', 'Bihar', '10', 'Retail'],
  ['TechNova Solutions', 'Priya Menon', 'Bengaluru', 'Karnataka', '29', 'Services / Freelance'],
  ['Annapurna Foods Pvt Ltd', 'Harish Reddy', 'Hyderabad', 'Telangana', '36', 'Manufacturing'],
  ['Maa Durga Steel', 'Sanjay Banerjee', 'Kolkata', 'West Bengal', '19', 'Manufacturing'],
  ['Punjab Auto Parts', 'Gurpreet Singh', 'Ludhiana', 'Punjab', '03', 'Wholesale / Distribution'],
  ['Green Leaf Organics', 'Neha Kapoor', 'New Delhi', 'Delhi', '07', 'Retail'],
  ['Shiv Shakti Cement Agency', 'Mahesh Tiwari', 'Bhopal', 'Madhya Pradesh', '23', 'Hardware'],
  ['Konkan Seafoods Export', 'Ashok Naik', 'Panaji', 'Goa', '30', 'Manufacturing'],
  ['Arora Garments', 'Rohit Arora', 'Chandigarh', 'Chandigarh', '04', 'Textile'],
  ['Kerala Spice House', 'Thomas Varghese', 'Kochi', 'Kerala', '32', 'Wholesale / Distribution'],
  ['Bharat Mobile Point', 'Imran Khan', 'Indore', 'Madhya Pradesh', '23', 'Electronics & Mobile'],
  ['Saraswati Book Depot', 'Kiran Joshi', 'Dehradun', 'Uttarakhand', '05', 'Retail'],
  ['Mehta Chemicals', 'Jayesh Mehta', 'Surat', 'Gujarat', '24', 'Manufacturing'],
  ['Laxmi Sweets & Namkeen', 'Pooja Agrawal', 'Nagpur', 'Maharashtra', '27', 'Retail'],
  ['Odisha Agro Mart', 'Biswajit Das', 'Bhubaneswar', 'Odisha', '21', 'Wholesale / Distribution'],
  ['CA Nikhil & Associates', 'Nikhil Jain', 'Raipur', 'Chhattisgarh', '22', 'Services / Freelance'],
  ['Himalaya Woollens', 'Tenzin Norbu', 'Shimla', 'Himachal Pradesh', '02', 'Textile'],
  ['Assam Tea Traders', 'Rupam Bora', 'Guwahati', 'Assam', '18', 'Wholesale / Distribution']
];

const PAN_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function fakeGstin(stateCode: string, i: number) {
  const l = (n: number) => PAN_LETTERS[(i * 7 + n * 3) % PAN_LETTERS.length];
  return `${stateCode}${l(1)}${l(2)}${l(3)}${l(4)}${l(5)}${String(1000 + i * 37).slice(-4)}${l(6)}1Z${(i % 9) + 1}`;
}

export const INITIAL_MERCHANTS: Merchant[] = MERCHANT_SEED.map(([biz, owner, city, state, code, industry], i) => {
  const planId: PlanId = (['free', 'silver', 'gold', 'platinum', 'gold', 'silver', 'free', 'gold'] as PlanId[])[i % 8];
  let status: MerchantStatus = 'ACTIVE';
  if (i % 11 === 6) status = 'TRIAL';
  if (i % 9 === 4) status = 'PAST_DUE';
  if (i === 13) status = 'SUSPENDED';
  if (i === 20) status = 'CHURNED';
  if (planId === 'free' && status === 'ACTIVE' && i % 2 === 0) status = 'TRIAL';
  const signupOffset = -Math.floor(20 + rand() * 520);
  const signupDate = addDays(ADMIN_TODAY, signupOffset);
  const cycle: BillingCycle = status === 'TRIAL' ? 'TRIAL' : planId === 'free' ? '1Y' : pick(['1Y', '1Y', '2Y', '3Y', 'LIFETIME'] as BillingCycle[]);
  const trialEndsOn = status === 'TRIAL' ? addDays(ADMIN_TODAY, Math.floor(rand() * 7)) : undefined;
  const planValidUntil = status === 'TRIAL' ? trialEndsOn! : cycle === 'LIFETIME' ? '2099-12-31' : addDays(ADMIN_TODAY, Math.floor(-10 + rand() * 340));
  const platforms: ClientPlatform[] = rand() > 0.5 ? ['Android', 'Web'] : rand() > 0.6 ? ['Android', 'iOS', 'Web'] : ['Android'];
  const plan = INITIAL_PLANS.find(p => p.id === planId)!;
  const lastActiveDays = status === 'CHURNED' ? 46 : status === 'SUSPENDED' ? 12 : Math.floor(rand() * 4);
  return {
    id: 'mer-' + (1001 + i),
    businessName: biz,
    ownerName: owner,
    phone: '+91 ' + (98000 + i * 131) + ' ' + String(10000 + i * 2711).slice(-5),
    email: owner.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@' + (i % 3 === 0 ? 'gmail.com' : 'outlook.com'),
    gstin: i % 10 === 7 ? '' : fakeGstin(code, i),
    gstType: i % 10 === 7 ? 'UNREGISTERED' : i % 6 === 5 ? 'COMPOSITION' : 'REGULAR',
    industry,
    city,
    state,
    planId,
    cycle,
    status,
    signupDate,
    trialEndsOn,
    planValidUntil,
    lastActive: addDays(ADMIN_TODAY, -lastActiveDays),
    platforms,
    language: i % 3 === 1 ? 'Hindi' : 'English',
    aatoBand: planId === 'platinum' ? (i % 2 ? '> ₹10 Cr' : '₹5–10 Cr') : '< ₹5 Cr',
    usage: {
      invoicesThisMonth: Math.floor(20 + rand() * (planId === 'free' ? 80 : 900)),
      users: Math.max(1, Math.min(plan.limits.users, Math.floor(1 + rand() * plan.limits.users + (i % 7 === 0 ? 1 : 0)))),
      businesses: Math.max(1, Math.floor(rand() * plan.limits.businesses) + 1),
      eWayBillsThisYear: plan.limits.eWayBillsPerYear === 0 ? 0 : Math.floor(rand() * (plan.limits.eWayBillsPerYear ?? 1500)),
      eInvoicesThisYear: plan.limits.eInvoicesPerYear ? Math.floor(rand() * plan.limits.eInvoicesPerYear * 1.05) : 0
    },
    lifetimeRevenue: planId === 'free' ? 0 : Math.round(plan.priceYearly * (1 + rand() * 2) * 1.18)
  };
});

export function cycleAmount(plan: PlanConfig, cycle: BillingCycle): number {
  switch (cycle) {
    case '2Y': return plan.price2Years;
    case '3Y': return plan.price3Years;
    case 'LIFETIME': return plan.priceLifetime;
    case 'TRIAL': return 0;
    default: return plan.priceYearly;
  }
}

export const INITIAL_SUBSCRIPTIONS: SubscriptionRecord[] = INITIAL_MERCHANTS.filter(m => m.planId !== 'free').map((m, i) => {
  const plan = INITIAL_PLANS.find(p => p.id === m.planId)!;
  const base = cycleAmount(plan, m.cycle);
  const couponCode = i % 4 === 1 ? 'DIWALI26' : i % 5 === 3 ? 'CAPARTNER' : undefined;
  const discount = couponCode === 'DIWALI26' ? Math.round(base * 0.3) : couponCode === 'CAPARTNER' ? Math.round(base * 0.2) : 0;
  const taxable = base - discount;
  const gst = Math.round(taxable * GST_ON_SUBSCRIPTION) / 100;
  const status =
    m.status === 'TRIAL' ? 'TRIAL' :
    m.status === 'PAST_DUE' ? 'PAST_DUE' :
    m.status === 'CHURNED' ? 'CANCELLED' :
    m.status === 'SUSPENDED' ? 'EXPIRED' : 'ACTIVE';
  return {
    id: 'sub-' + (5001 + i),
    invoiceNo: `MI/SUB/26-27/${String(301 + i).padStart(5, '0')}`,
    merchantId: m.id,
    merchantName: m.businessName,
    merchantGstin: m.gstin,
    planId: m.planId,
    cycle: m.cycle,
    baseAmount: base,
    discount,
    gstAmount: gst,
    totalAmount: Math.round((taxable + gst) * 100) / 100,
    gateway: m.platforms.includes('iOS') ? 'MANUAL' : i % 3 === 0 ? 'PLAY_BILLING' : 'RAZORPAY',
    status,
    startDate: addDays(m.planValidUntil, m.cycle === '2Y' ? -730 : m.cycle === '3Y' ? -1095 : -365),
    renewsOn: m.planValidUntil,
    autoRenew: status === 'ACTIVE' && i % 3 !== 2,
    couponCode,
    addOns: i % 3 === 0 ? ['addon-wa'] : i % 4 === 2 ? ['addon-user', 'addon-filing'] : []
  };
});

const AGENTS = ['Priyanshu (L2)', 'Sneha (L1)', 'Arjun (GST Expert)', 'Unassigned'];

export const SUPPORT_AGENTS = AGENTS;

export const INITIAL_TICKETS: SupportTicket[] = [
  {
    id: 'tkt-1', ticketNo: 'MI-TKT-2041', merchantId: 'mer-1004', merchantName: 'Om Sai Hardware', phone: '+91 98393 18133',
    subject: 'IRN generation failing — "Invalid HSN code 7308"', category: 'E_INVOICE', priority: 'URGENT', status: 'OPEN', channel: 'WHATSAPP',
    assignee: 'Arjun (GST Expert)', createdAt: '2026-11-04 09:12', updatedAt: '2026-11-04 09:40',
    messages: [
      { id: 'm1', from: 'MERCHANT', author: 'Prakash Patil', text: 'IRN nahi ban raha, error aa raha hai Invalid HSN. Customer ko aaj hi bill chahiye.', at: '2026-11-04 09:12' },
      { id: 'm2', from: 'SYSTEM', author: 'GSP · IRIS', text: 'IRP error 2265: HSN 7308 requires 6 digits for AATO > ₹5 Cr.', at: '2026-11-04 09:13' }
    ]
  },
  {
    id: 'tkt-2', ticketNo: 'MI-TKT-2040', merchantId: 'mer-1011', merchantName: 'Punjab Auto Parts', phone: '+91 99310 37321',
    subject: 'e-Way bill vehicle number update not saving', category: 'EWAY_BILL', priority: 'HIGH', status: 'IN_PROGRESS', channel: 'CALL',
    assignee: 'Priyanshu (L2)', createdAt: '2026-11-03 17:45', updatedAt: '2026-11-04 08:30',
    messages: [
      { id: 'm1', from: 'MERCHANT', author: 'Gurpreet Singh', text: 'Truck changed mid-route. Part B update shows success but EWB still has old vehicle.', at: '2026-11-03 17:45' },
      { id: 'm2', from: 'AGENT', author: 'Priyanshu (L2)', text: 'Checking with GSP logs. Please share the EWB number.', at: '2026-11-03 18:02' },
      { id: 'm3', from: 'MERCHANT', author: 'Gurpreet Singh', text: 'EWB 241093847562', at: '2026-11-03 18:10' }
    ]
  },
  {
    id: 'tkt-3', ticketNo: 'MI-TKT-2039', merchantId: 'mer-1002', merchantName: 'Gupta Electronics & Mobiles', phone: '+91 98131 12711',
    subject: 'Charged twice for Silver renewal via Play Store', category: 'SUBSCRIPTION', priority: 'HIGH', status: 'WAITING_ON_MERCHANT', channel: 'EMAIL',
    assignee: 'Sneha (L1)', createdAt: '2026-11-02 11:20', updatedAt: '2026-11-03 10:05',
    messages: [
      { id: 'm1', from: 'MERCHANT', author: 'Ankit Gupta', text: 'I see two debits of ₹2,358.82 on 1 Nov. Please refund one.', at: '2026-11-02 11:20' },
      { id: 'm2', from: 'AGENT', author: 'Sneha (L1)', text: 'Sorry for the trouble! Could you share the Google Play order IDs (GPA.xxxx) for both charges?', at: '2026-11-03 10:05' }
    ]
  },
  {
    id: 'tkt-4', ticketNo: 'MI-TKT-2038', merchantId: 'mer-1007', merchantName: 'Fresh Basket Kirana', phone: '+91 98786 26977',
    subject: 'Thermal printer (58mm) prints blank receipts', category: 'PRINTING', priority: 'MEDIUM', status: 'OPEN', channel: 'IN_APP',
    assignee: 'Unassigned', createdAt: '2026-11-03 20:14', updatedAt: '2026-11-03 20:14',
    messages: [{ id: 'm1', from: 'MERCHANT', author: 'Suresh Yadav', text: 'Bluetooth printer connected hai lekin bill khali print ho raha hai.', at: '2026-11-03 20:14' }]
  },
  {
    id: 'tkt-5', ticketNo: 'MI-TKT-2035', merchantId: 'mer-1022', merchantName: 'CA Nikhil & Associates', phone: '+91 100751 66951',
    subject: 'GSTR-1 JSON rejected on portal — B2CS section', category: 'GSTR_FILING', priority: 'MEDIUM', status: 'RESOLVED', channel: 'EMAIL',
    assignee: 'Arjun (GST Expert)', createdAt: '2026-11-01 14:00', updatedAt: '2026-11-02 12:30',
    messages: [
      { id: 'm1', from: 'MERCHANT', author: 'Nikhil Jain', text: 'Portal says "Invalid place of supply" for B2CS rows.', at: '2026-11-01 14:00' },
      { id: 'm2', from: 'AGENT', author: 'Arjun (GST Expert)', text: 'Fixed in v3.4.2 — POS was exported as state name instead of code. Please re-export.', at: '2026-11-02 12:30' }
    ]
  },
  {
    id: 'tkt-6', ticketNo: 'MI-TKT-2033', merchantId: 'mer-1019', merchantName: 'Mehta Chemicals', phone: '+91 100358 50511',
    subject: 'Need to add 2 more staff logins', category: 'ACCOUNT', priority: 'LOW', status: 'CLOSED', channel: 'WHATSAPP',
    assignee: 'Sneha (L1)', createdAt: '2026-10-30 10:00', updatedAt: '2026-10-30 16:20',
    messages: [
      { id: 'm1', from: 'MERCHANT', author: 'Jayesh Mehta', text: 'Can we add 2 more users for accountant?', at: '2026-10-30 10:00' },
      { id: 'm2', from: 'AGENT', author: 'Sneha (L1)', text: 'Done — 2 × Extra user add-on applied. GST invoice sent on email.', at: '2026-10-30 16:20' }
    ]
  },
  {
    id: 'tkt-7', ticketNo: 'MI-TKT-2042', merchantId: 'mer-1009', merchantName: 'Annapurna Foods Pvt Ltd', phone: '+91 99048 31699',
    subject: 'App crashes when adding item with image (Android 15)', category: 'APP_BUG', priority: 'HIGH', status: 'OPEN', channel: 'IN_APP',
    assignee: 'Unassigned', createdAt: '2026-11-04 10:02', updatedAt: '2026-11-04 10:02',
    messages: [{ id: 'm1', from: 'MERCHANT', author: 'Harish Reddy', text: 'Every time I attach item photo the app closes. Samsung S24, app v3.4.2.', at: '2026-11-04 10:02' }]
  }
];

export const INITIAL_FLAGS: FeatureFlag[] = [
  { key: 'offline_sync', name: 'Offline-first sync', description: 'Local SQLite/Drift DB with background sync queue & conflict handling', phase: 'P1', enabled: true, rollout: 25, plans: ['silver', 'gold', 'platinum'], platforms: ['Android'], updatedAt: '2026-11-01' },
  { key: 'bulk_irn', name: 'Bulk e-Invoice (IRN)', description: 'Generate IRNs for multiple invoices in one click', phase: 'P1', enabled: true, rollout: 100, plans: ['platinum'], platforms: ['Android', 'iOS', 'Web'], updatedAt: '2026-10-22' },
  { key: 'ewb_prevalidation', name: 'e-Way bill pre-validation engine', description: 'GSTIN status, pincode-state, HSN validity, distance & value threshold checks before submit', phase: 'P0', enabled: true, rollout: 100, plans: ['gold', 'platinum'], platforms: ['Android', 'iOS', 'Web'], updatedAt: '2026-10-10' },
  { key: 'ocr_purchase', name: 'AI / OCR purchase bill scan', description: 'Photo of supplier bill → purchase entry', phase: 'P2', enabled: false, rollout: 0, plans: ['gold', 'platinum'], platforms: ['Android', 'iOS'], updatedAt: '2026-10-28' },
  { key: 'voice_billing', name: 'Voice billing (Hinglish)', description: '"Ramesh ko 10 kilo cheeni 45 rupaye" → draft invoice', phase: 'P2', enabled: true, rollout: 5, plans: ['free', 'silver', 'gold', 'platinum'], platforms: ['Android'], updatedAt: '2026-11-03' },
  { key: 'gstr2b_recon', name: 'GSTR-2B / IMS reconciliation', description: 'Match purchase register with GSTR-2B for ITC', phase: 'P1', enabled: false, rollout: 0, plans: ['gold', 'platinum'], platforms: ['Web'], updatedAt: '2026-09-30' },
  { key: 'thermal_pos', name: 'Thermal POS quick-bill', description: 'ESC/POS over Bluetooth/USB, 58mm & 80mm layouts', phase: 'P1', enabled: true, rollout: 100, plans: ['gold', 'platinum'], platforms: ['Android', 'Web'], updatedAt: '2026-10-15' },
  { key: 'customer_portal', name: 'Public invoice link / customer portal', description: 'Customer views, downloads and pays invoice online', phase: 'P1', enabled: true, rollout: 50, plans: ['silver', 'gold', 'platinum'], platforms: ['Web'], updatedAt: '2026-10-25' },
  { key: 'tally_export', name: 'Tally export', description: 'Export vouchers in Tally XML format', phase: 'P1', enabled: true, rollout: 100, plans: ['gold', 'platinum'], platforms: ['Web'], updatedAt: '2026-08-12' },
  { key: 'hindi_ui', name: 'Hindi interface', description: 'Full Hindi translation of app + invoice labels', phase: 'P0', enabled: true, rollout: 100, plans: ['free', 'silver', 'gold', 'platinum'], platforms: ['Android', 'iOS', 'Web'], updatedAt: '2026-07-01' },
  { key: 'ca_portal', name: 'CA collaboration portal', description: 'One CA manages many clients\' GSTR-1 / 2B reconciliation', phase: 'P2', enabled: false, rollout: 0, plans: ['platinum'], platforms: ['Web'], updatedAt: '2026-11-02' }
];

export const INITIAL_BROADCASTS: Broadcast[] = [
  { id: 'bc-1', title: 'GSTR-1 due 11 Nov', message: 'Reminder: GSTR-1 for October is due on 11 Nov 2026. Export JSON from Reports → GSTR-1.', channels: ['PUSH', 'WHATSAPP'], segment: 'PAID', language: 'English', status: 'SENT', sentAt: '2026-11-03 10:00', recipients: 10110, delivered: 9876, opened: 6120, createdBy: 'Super Admin' },
  { id: 'bc-2', title: 'दिवाली ऑफर — 30% छूट', message: 'शुभ दीपावली! DIWALI26 कोड से किसी भी प्लान पर 30% छूट पाएं। ऑफर 15 नवंबर तक।', channels: ['PUSH', 'SMS'], segment: 'FREE', language: 'Hindi', status: 'SENT', sentAt: '2026-10-28 18:30', recipients: 14200, delivered: 13650, opened: 4390, createdBy: 'Growth Team' },
  { id: 'bc-3', title: 'Your trial ends soon', message: 'Your Mango Invoice trial ends in 2 days. Upgrade to keep e-way bills and remove the watermark.', channels: ['PUSH', 'EMAIL'], segment: 'TRIAL_EXPIRING', language: 'English', status: 'SCHEDULED', scheduledAt: '2026-11-05 09:00', recipients: 312, delivered: 0, opened: 0, createdBy: 'Super Admin' }
];

export const INITIAL_INTEGRATIONS: Integration[] = [
  {
    key: 'gsp', name: 'e-Invoice & e-Way Bill GSP', category: 'GSP (e-Invoice / e-Way Bill)', provider: 'IRIS', providerOptions: ['IRIS', 'Masters India', 'Vayana', 'Cygnet', 'ClearTax', 'Quicko'],
    environment: 'SANDBOX', status: 'CONNECTED', lastChecked: '2026-11-04 09:00',
    fields: [
      { label: 'ASP / Client ID', key: 'clientId', value: 'MANGO_ASP_7781' },
      { label: 'Client Secret', key: 'clientSecret', value: 'sk_iris_9f3a2b77c1', secret: true },
      { label: 'Sandbox base URL', key: 'baseUrl', value: 'https://einv-apisandbox.nic.in' }
    ],
    note: 'SMB apps go via GSP; direct IRP access is restricted. Per-API-call pricing. MFA mandatory on e-invoice / e-way portals.'
  },
  {
    key: 'gstin_lookup', name: 'GSTIN lookup (public API)', category: 'GSP (e-Invoice / e-Way Bill)', provider: 'IRIS', providerOptions: ['IRIS', 'Masters India', 'Vayana'],
    environment: 'PRODUCTION', status: 'CONNECTED', lastChecked: '2026-11-04 09:00',
    fields: [{ label: 'API key', key: 'apiKey', value: 'pk_gstin_23ab91', secret: true }],
    note: 'Auto-fills legal name, address and state from GSTIN on business & party creation.'
  },
  {
    key: 'razorpay', name: 'Payment links & subscriptions', category: 'Payments', provider: 'Razorpay', providerOptions: ['Razorpay', 'Cashfree', 'PhonePe PG'],
    environment: 'PRODUCTION', status: 'CONNECTED', lastChecked: '2026-11-04 08:45',
    fields: [
      { label: 'Key ID', key: 'keyId', value: 'rzp_live_Mng82hT1' },
      { label: 'Key Secret', key: 'keySecret', value: 'rzp_secret_xxxxxxxx', secret: true },
      { label: 'Webhook URL', key: 'webhook', value: 'https://api.mangoinvoice.in/webhooks/razorpay' }
    ],
    note: 'Webhooks auto-reconcile invoice payments and subscription renewals.'
  },
  {
    key: 'play_billing', name: 'Google Play Billing', category: 'Payments', provider: 'Google Play', providerOptions: ['Google Play'],
    environment: 'PRODUCTION', status: 'CONNECTED', lastChecked: '2026-11-04 08:45',
    fields: [
      { label: 'Package name', key: 'package', value: 'in.firstwave.mangoinvoice' },
      { label: 'Service account JSON', key: 'sa', value: 'play-billing@mango.iam.gserviceaccount.com', secret: true }
    ],
    note: 'In-app subscription purchases on Android. RTDN topic must be configured.'
  },
  {
    key: 'whatsapp', name: 'WhatsApp Business (Cloud API)', category: 'Messaging', provider: 'Interakt', providerOptions: ['Interakt', 'WATI', 'Gupshup', 'Meta Cloud API (direct)'],
    environment: 'PRODUCTION', status: 'ERROR', lastChecked: '2026-11-04 07:30',
    fields: [
      { label: 'API key', key: 'apiKey', value: 'int_live_ab12', secret: true },
      { label: 'Sender number', key: 'sender', value: '+91 90000 12345' }
    ],
    note: 'Template "payment_reminder_v3" rejected by Meta — resubmit for approval.'
  },
  {
    key: 'sms', name: 'SMS & OTP', category: 'Auth / OTP', provider: 'MSG91', providerOptions: ['MSG91', 'Firebase Auth'],
    environment: 'PRODUCTION', status: 'CONNECTED', lastChecked: '2026-11-04 09:05',
    fields: [
      { label: 'Auth key', key: 'authKey', value: 'msg91_8811aa', secret: true },
      { label: 'DLT Entity ID', key: 'dlt', value: '1201162847362910' },
      { label: 'Sender ID', key: 'sender', value: 'MANGOI' }
    ],
    note: 'DLT registration required for all transactional / promotional templates.'
  },
  {
    key: 'backup', name: 'Cloud storage & daily backup', category: 'Storage & Backup', provider: 'AWS Mumbai (ap-south-1)', providerOptions: ['AWS Mumbai (ap-south-1)', 'GCP Mumbai (asia-south1)'],
    environment: 'PRODUCTION', status: 'CONNECTED', lastChecked: '2026-11-04 03:00',
    fields: [
      { label: 'S3 bucket', key: 'bucket', value: 'mango-invoice-prod-pdfs' },
      { label: 'Backup schedule', key: 'cron', value: 'Daily 03:00 IST · 30-day retention' }
    ],
    note: 'Data residency in India. Encryption in transit and at rest.'
  }
];

export const INITIAL_COMPLIANCE: ComplianceRules = {
  irpReportingWindowDays: 30,
  irnCancelWindowHours: 24,
  eWayBillThreshold: 50000,
  eWayBillMaxDocAgeDays: 180,
  eInvoiceAatoThresholdCr: 5,
  b2cLargeThreshold: 50000,
  hsnDigitsBelow5Cr: 4,
  hsnDigitsAbove5Cr: 6,
  invoiceNumberMaxLength: 16,
  warnDaysBeforeIrpDeadline: 5
};

// 30 days of platform metrics
export const DAILY_METRICS: DailyMetric[] = Array.from({ length: 30 }, (_, i) => {
  const date = addDays(ADMIN_TODAY, i - 29);
  const dow = new Date(date + 'T00:00:00').getDay();
  const weekend = dow === 0;
  const trend = 1 + i * 0.012;
  const diwaliDip = date >= '2026-10-31' && date <= '2026-11-02' ? 0.55 : 1;
  const invoices = Math.round((38000 + rand() * 6000) * trend * (weekend ? 0.62 : 1) * diwaliDip);
  const signups = Math.round((410 + rand() * 120) * trend * (weekend ? 0.7 : 1));
  const activated = Math.round(signups * (0.52 + rand() * 0.12));
  return { date, invoices, signups, activated, activeMerchants: Math.round((21500 + rand() * 1500) * trend * (weekend ? 0.7 : 1)) };
});

export const RETENTION_COHORTS: RetentionCohort[] = [
  { cohort: 'May 2026', size: 9820, retention: [100, 61, 52, 47, 44, 42, 41] },
  { cohort: 'Jun 2026', size: 10450, retention: [100, 63, 54, 49, 46, 44] },
  { cohort: 'Jul 2026', size: 11210, retention: [100, 64, 55, 50, 47] },
  { cohort: 'Aug 2026', size: 12030, retention: [100, 66, 57, 52] },
  { cohort: 'Sep 2026', size: 12880, retention: [100, 67, 58] },
  { cohort: 'Oct 2026', size: 14120, retention: [100, 69] },
  { cohort: 'Nov 2026', size: 1890, retention: [100] }
];

// Platform-wide totals (the merchant list above is a sample of the full base)
export const PLATFORM_TOTALS = {
  merchants: 48210,
  paidMerchants: 11480,
  trials: 2140,
  planMix: { free: 34590, silver: 5620, gold: 4310, platinum: 1550 } as Record<PlanId, number>,
  mrr: 3218400,
  churnRateMonthly: 2.8,
  einvoicesThisMonth: 182340,
  ewaybillsThisMonth: 96410
};
