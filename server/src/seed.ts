/**
 * Seeds the plans, feature flags and compliance rules, plus a super-admin login.
 * Idempotent: safe to run again. Usage: npm run server:seed
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD set the super-admin credentials.
 */
import { connectDb, disconnectDb } from './db';
import { User } from './models/core';
import { DEFAULT_COMPLIANCE, FeatureFlag, Plan, Setting } from './models/platform';
import { hashPassword } from './services/auth';

export const PLANS = [
  { _id: 'free', name: 'Free', tagline: 'Unlimited GST invoices on mobile', priceYearly: 0, price2Years: 0, price3Years: 0, priceLifetime: 0, limits: { invoicesPerMonth: null, users: 1, businesses: 1, eWayBillsPerYear: 0, eInvoicesPerYear: 0 }, features: ['Unlimited GST invoices (mobile)', '1 user', 'Basic reports'], watermark: true, isActive: true },
  { _id: 'silver', name: 'Silver', tagline: 'For retail shops going digital', priceYearly: 1999, price2Years: 3499, price3Years: 4799, priceLifetime: 9999, limits: { invoicesPerMonth: null, users: 1, businesses: 1, eWayBillsPerYear: 0, eInvoicesPerYear: 0 }, features: ['No watermark', 'Web access', 'All document types', 'Payment reminders', 'GSTR-1/3B reports'], watermark: false, highlight: 'Popular', isActive: true },
  { _id: 'gold', name: 'Gold', tagline: 'Traders, wholesalers & distributors', priceYearly: 3999, price2Years: 6999, price3Years: 9499, priceLifetime: 17999, limits: { invoicesPerMonth: null, users: 3, businesses: 1, eWayBillsPerYear: 600, eInvoicesPerYear: 0 }, features: ['Everything in Silver', 'e-Way bill', '3 users', 'Advanced inventory', 'Thermal POS', 'Tally export'], watermark: false, highlight: 'Best value', isActive: true },
  { _id: 'platinum', name: 'Platinum', tagline: 'e-Invoice ready (AATO > ₹5 Cr)', priceYearly: 6999, price2Years: 12499, price3Years: 16999, priceLifetime: 29999, limits: { invoicesPerMonth: null, users: 10, businesses: 5, eWayBillsPerYear: null, eInvoicesPerYear: 3000 }, features: ['Everything in Gold', 'e-Invoice (IRN + QR)', 'Bulk IRN', 'Multi-business', 'API access', 'Priority support'], watermark: false, isActive: true }
];

const FLAGS = [
  { _id: 'offline_sync', name: 'Offline-first sync', phase: 'P1', enabled: false, rollout: 0, plans: ['silver', 'gold', 'platinum'], platforms: ['Android'] },
  { _id: 'bulk_irn', name: 'Bulk e-Invoice (IRN)', phase: 'P1', enabled: false, rollout: 0, plans: ['platinum'], platforms: ['Android', 'iOS', 'Web'] },
  { _id: 'ewb_prevalidation', name: 'e-Way bill pre-validation engine', phase: 'P0', enabled: true, rollout: 100, plans: ['gold', 'platinum'], platforms: [] },
  { _id: 'thermal_pos', name: 'Thermal POS quick-bill', phase: 'P1', enabled: false, rollout: 0, plans: ['gold', 'platinum'], platforms: ['Android', 'Web'] },
  { _id: 'hindi_ui', name: 'Hindi interface', phase: 'P0', enabled: true, rollout: 100, plans: ['free', 'silver', 'gold', 'platinum'], platforms: [] },
  { _id: 'ocr_purchase', name: 'AI / OCR purchase bill scan', phase: 'P2', enabled: false, rollout: 0, plans: ['gold', 'platinum'], platforms: ['Android', 'iOS'] },
  { _id: 'voice_billing', name: 'Voice billing (Hinglish)', phase: 'P2', enabled: false, rollout: 0, plans: ['free', 'silver', 'gold', 'platinum'], platforms: ['Android'] }
];

export async function seedPlatform() {
  for (const p of PLANS) await Plan.updateOne({ _id: p._id }, { $setOnInsert: p }, { upsert: true });
  for (const f of FLAGS) await FeatureFlag.updateOne({ _id: f._id }, { $setOnInsert: f }, { upsert: true });
  await Setting.updateOne({ _id: 'compliance' }, { $setOnInsert: { value: DEFAULT_COMPLIANCE } }, { upsert: true });
}

async function main() {
  await connectDb();
  await seedPlatform();
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters');
    await User.updateOne(
      { email: email.toLowerCase() },
      { $set: { platformRole: 'SUPER_ADMIN', passwordHash: await hashPassword(password) }, $setOnInsert: { name: 'Super Admin', email: email.toLowerCase() } },
      { upsert: true }
    );
    console.log(`Super admin ready: ${email}`);
  } else {
    console.log('Skipped super admin (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one)');
  }
  console.log('Seeded plans, feature flags and compliance rules');
  await disconnectDb();
}

// runs when executed directly: tsx server/src/seed.ts (dev) or node dist-server/seed.js (production)
if (/seed\.(ts|js)$/.test(process.argv[1] ?? '')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
