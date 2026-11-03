/**
 * End-to-end API tests against a real MongoDB replica set (transactions need one).
 * Run: npm run server:test
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import request from 'supertest';
import type { Express } from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret-123';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-test-refresh-secret-12';
process.env.SMS_PROVIDER = 'console';
process.env.GSP_MODE = 'mock';

let mongo: MongoMemoryReplSet;
let app: Express;
let disconnect: () => Promise<void>;

// Valid GSTINs (checksum computed) for Delhi (07), Uttar Pradesh (09)
import { gstinCheckChar } from '../../shared/gst';
const gstin = (state: string, pan: string) => `${state}${pan}1Z${gstinCheckChar(`${state}${pan}1Z`)}`;
const SELLER = gstin('07', 'AAACM1234A');
const BUYER_UP = gstin('09', 'AABCS5678K');
const SUPPLIER_DL = gstin('07', 'AAACH0001H');

async function login(phone: string) {
  const r1 = await request(app).post('/api/auth/otp/request').send({ phone });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  const r2 = await request(app).post('/api/auth/otp/verify').send({ phone, code: r1.body.devCode, name: 'Test ' + phone.slice(-4) });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  return r2.body as { accessToken: string; refreshToken: string; isNew: boolean };
}

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const db = await import('../src/db');
  await db.connectDb(mongo.getUri('mango_test'));
  disconnect = db.disconnectDb;
  const { seedPlatform } = await import('../src/seed');
  await seedPlatform();
  const { createApp } = await import('../src/app');
  app = createApp();
  // make sure indexes (unique numbers etc.) exist before tests race on them
  const mongoose = (await import('mongoose')).default;
  await Promise.all(Object.values(mongoose.models).map(m => m.syncIndexes()));
});

after(async () => {
  await disconnect?.();
  await mongo?.stop();
});

describe('Mango Invoice API', () => {
  let token = '';
  let bizId = '';
  let customerId = '';
  let supplierId = '';
  let productId = '';
  let invoiceId = '';
  let invoiceNo = '';
  const auth = () => ({ Authorization: `Bearer ${token}`, 'X-Business-Id': bizId });

  test('health', async () => {
    const r = await request(app).get('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.db, 'connected');
  });

  test('OTP login creates an account; wrong OTP is rejected', async () => {
    const r1 = await request(app).post('/api/auth/otp/request').send({ phone: '98100 00001' });
    assert.equal(r1.status, 200);
    const bad = await request(app).post('/api/auth/otp/verify').send({ phone: '9810000001', code: '000000' === r1.body.devCode ? '111111' : '000000' });
    assert.equal(bad.status, 400);
    const ok = await request(app).post('/api/auth/otp/verify').send({ phone: '+91 98100 00001', code: r1.body.devCode, name: 'Ramesh' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.isNew, true);
    token = ok.body.accessToken;
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.body.user.phone, '+919810000001');
  });

  test('refresh token rotates and a reused token is rejected', async () => {
    const s = await login('9810000009');
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: s.refreshToken });
    assert.equal(r1.status, 200);
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: s.refreshToken });
    assert.equal(reuse.status, 401);
  });

  test('requests without a token are rejected', async () => {
    assert.equal((await request(app).get('/api/parties')).status, 401);
  });

  test('business creation validates GSTIN checksum and starts a trial', async () => {
    const bad = await request(app).post('/api/businesses').set('Authorization', `Bearer ${token}`).send({ name: 'Sharma Electricals', gstin: '07AAACM1234A1Z0', stateCode: '07' });
    assert.equal(bad.status, 400);
    const r = await request(app).post('/api/businesses').set('Authorization', `Bearer ${token}`).send({ name: 'Sharma Electricals', gstin: SELLER, stateCode: '07', address: 'Nehru Place', city: 'New Delhi' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    bizId = r.body._id;
    assert.equal(r.body.trialPlanId, 'gold');
    const cur = await request(app).get('/api/businesses/current').set(auth());
    assert.equal(cur.body.role, 'OWNER');
    assert.equal(cur.body.plan._id, 'gold');
    assert.equal(cur.body.plan.onTrial, true);
  });

  test('masters: customer (inter-state), supplier, product with opening stock', async () => {
    const c = await request(app).post('/api/parties').set(auth()).send({ type: 'CUSTOMER', name: 'Sunrise Buildcon', gstin: BUYER_UP, stateCode: '09', phone: '9958011447', billingAddress: 'Noida' });
    assert.equal(c.status, 201, JSON.stringify(c.body));
    customerId = c.body._id;
    const mismatch = await request(app).post('/api/parties').set(auth()).send({ type: 'CUSTOMER', name: 'X', gstin: BUYER_UP, stateCode: '07' });
    assert.equal(mismatch.status, 400);
    const s = await request(app).post('/api/parties').set(auth()).send({ type: 'SUPPLIER', name: 'Havells Distributor', gstin: SUPPLIER_DL, stateCode: '07' });
    supplierId = s.body._id;
    const p = await request(app).post('/api/products').set(auth()).send({ name: 'Ceiling Fan 1200mm', hsnCode: '8414', unit: 'PCS', purchasePrice: 1650, sellingPrice: 2299, taxRate: 18, openingStock: 10, minStock: 2 });
    assert.equal(p.status, 201, JSON.stringify(p.body));
    productId = p.body._id;
  });

  test('invoice: server computes IGST, numbers per settings, moves stock and receivable', async () => {
    const r = await request(app)
      .post('/api/invoices')
      .set(auth())
      // client-sent totals would be ignored; only item inputs matter
      .send({ partyId: customerId, items: [{ productId, quantity: 3, discountPercent: 5 }], amountPaid: 1000, paymentMode: 'UPI' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    invoiceId = r.body._id;
    invoiceNo = r.body.number;
    assert.match(invoiceNo, /^INV\/\d\d-\d\d\/0001$/);
    assert.equal(r.body.isInterState, true);
    assert.equal(r.body.taxableTotal, 6552.15);
    assert.equal(r.body.igstTotal, 1179.39);
    assert.equal(r.body.cgstTotal, 0);
    assert.equal(r.body.grandTotal, 7732);
    assert.equal(r.body.balanceDue, 6732);
    assert.equal(r.body.status, 'PARTIALLY_PAID');

    const p = await request(app).get('/api/products').set(auth());
    assert.equal(p.body.items[0].stock, 7);
    const party = (await request(app).get('/api/parties?type=CUSTOMER').set(auth())).body.items[0];
    assert.equal(party.balance, 6732);
  });

  test('invoice: not enough stock is rejected and nothing is written', async () => {
    const r = await request(app).post('/api/invoices').set(auth()).send({ partyId: customerId, items: [{ productId, quantity: 50 }] });
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Not enough stock/);
    const list = await request(app).get('/api/invoices').set(auth());
    assert.equal(list.body.total, 1);
    const p = await request(app).get('/api/products').set(auth());
    assert.equal(p.body.items[0].stock, 7);
  });

  test('invoice: duplicate manual number and Rule 46 violations are rejected', async () => {
    const dup = await request(app).post('/api/invoices').set(auth()).send({ partyId: customerId, number: invoiceNo, items: [{ productId, quantity: 1 }] });
    assert.equal(dup.status, 409);
    const long = await request(app).post('/api/invoices').set(auth()).send({ partyId: customerId, number: 'INV 2026 BAD', items: [{ productId, quantity: 1 }] });
    assert.equal(long.status, 400);
  });

  test('payment in settles the invoice', async () => {
    const over = await request(app).post('/api/payments').set(auth()).send({ type: 'PAYMENT_IN', partyId: customerId, invoiceId, amount: 999999, mode: 'UPI' });
    assert.equal(over.status, 400);
    const r = await request(app).post('/api/payments').set(auth()).send({ type: 'PAYMENT_IN', partyId: customerId, invoiceId, amount: 6732, mode: 'NEFT_RTGS', reference: 'UTR123' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const inv = (await request(app).get(`/api/invoices/${invoiceId}`).set(auth())).body;
    assert.equal(inv.status, 'PAID');
    assert.equal(inv.balanceDue, 0);
  });

  test('purchase bill adds stock and payable; debit note reverses part', async () => {
    const bill = await request(app).post('/api/documents').set(auth()).send({ docType: 'PURCHASE_BILL', partyId: supplierId, reference: 'HVL/8821', items: [{ productId, quantity: 20 }] });
    assert.equal(bill.status, 201, JSON.stringify(bill.body));
    assert.equal(bill.body.cgstTotal, 2970); // 20 × 1650 × 9%
    assert.equal(bill.body.status, 'UNPAID');
    let p = (await request(app).get('/api/products').set(auth())).body.items[0];
    assert.equal(p.stock, 27);

    const dn = await request(app).post('/api/documents').set(auth()).send({ docType: 'DEBIT_NOTE', partyId: supplierId, reference: bill.body.number, reason: 'Damaged', items: [{ productId, quantity: 2 }] });
    assert.equal(dn.status, 201, JSON.stringify(dn.body));
    p = (await request(app).get('/api/products').set(auth())).body.items[0];
    assert.equal(p.stock, 25);
    const sup = (await request(app).get('/api/parties?type=SUPPLIER').set(auth())).body.items[0];
    assert.equal(sup.balance, -(bill.body.grandTotal - dn.body.grandTotal));
  });

  test('credit note against the invoice restocks and reduces liability in GSTR-3B', async () => {
    const cn = await request(app).post('/api/documents').set(auth()).send({ docType: 'CREDIT_NOTE', partyId: customerId, reference: invoiceNo, reason: 'Sales return', restock: true, items: [{ productId, quantity: 1, discountPercent: 5 }] });
    assert.equal(cn.status, 201, JSON.stringify(cn.body));
    const tooMuch = await request(app).post('/api/documents').set(auth()).send({ docType: 'CREDIT_NOTE', partyId: customerId, reference: invoiceNo, items: [{ productId, quantity: 10 }] });
    assert.equal(tooMuch.status, 400);
    const r = await request(app).get('/api/reports/gstr3b').set(auth());
    assert.equal(r.status, 200);
    assert.equal(r.body.table31a.igst, 1179.39);
    assert.equal(r.body.creditNotes.igst, cn.body.igstTotal);
    // ITC = bill CGST 2,970 − debit note CGST 297
    assert.equal(r.body.table4.eligible.cgst, 2673);
  });

  test('cancelling an invoice with a credit note is blocked; proforma converts to invoice', async () => {
    const blocked = await request(app).post(`/api/invoices/${invoiceId}/cancel`).set(auth()).send({ reason: 'Wrong party' });
    assert.equal(blocked.status, 409);
    const pf = await request(app).post('/api/documents').set(auth()).send({ docType: 'PROFORMA', partyId: customerId, items: [{ productId, quantity: 2 }] });
    assert.equal(pf.status, 201);
    const conv = await request(app).post(`/api/documents/${pf.body._id}/convert`).set(auth());
    assert.equal(conv.status, 201, JSON.stringify(conv.body));
    assert.match(conv.body.number, /0002$/);
    const again = await request(app).post(`/api/documents/${pf.body._id}/convert`).set(auth());
    assert.equal(again.status, 409);
  });

  test('cancel invoice keeps its number and restores stock', async () => {
    const inv = await request(app).post('/api/invoices').set(auth()).send({ partyId: customerId, items: [{ productId, quantity: 1 }] });
    const before = (await request(app).get('/api/products').set(auth())).body.items[0].stock;
    const c = await request(app).post(`/api/invoices/${inv.body._id}/cancel`).set(auth()).send({ reason: 'Customer cancelled order' });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    assert.equal(c.body.status, 'CANCELLED');
    const after = (await request(app).get('/api/products').set(auth())).body.items[0].stock;
    assert.equal(after, before + 1);
    const next = await request(app).post('/api/invoices').set(auth()).send({ partyId: customerId, items: [{ productId, quantity: 1 }] });
    assert.notEqual(next.body.number, inv.body.number, 'cancelled number must not be reused');
  });

  test('e-invoice pre-validation and mock IRN are clearly flagged', async () => {
    const v = await request(app).get(`/api/invoices/${invoiceId}/einvoice/validate`).set(auth());
    assert.equal(v.status, 200);
    // Gold trial has no e-invoicing → plan limit, nothing generated
    const r = await request(app).post(`/api/invoices/${invoiceId}/einvoice`).set(auth());
    assert.equal(r.status, 402, JSON.stringify(r.body));
  });

  test('roles: an accountant can read reports but cannot create invoices', async () => {
    const add = await request(app).post('/api/businesses/current/members').set(auth()).send({ phone: '9810000002', role: 'ACCOUNTANT' });
    assert.equal(add.status, 201, JSON.stringify(add.body));
    const ca = await login('9810000002');
    const h = { Authorization: `Bearer ${ca.accessToken}`, 'X-Business-Id': bizId };
    assert.equal((await request(app).get('/api/reports/pnl').set(h)).status, 200);
    assert.equal((await request(app).post('/api/invoices').set(h).send({ partyId: customerId, items: [{ productId, quantity: 1 }] })).status, 403);
  });

  test('tenancy: another user cannot read this business', async () => {
    const other = await login('9810000003');
    const r = await request(app).get('/api/invoices').set({ Authorization: `Bearer ${other.accessToken}`, 'X-Business-Id': bizId });
    assert.equal(r.status, 403);
  });

  test('platform admin: non-admins are blocked; plan activation issues a GST invoice', async () => {
    assert.equal((await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${token}`)).status, 403);
    const { User } = await import('../src/models/core');
    await User.updateOne({ phone: '+919810000001' }, { platformRole: 'SUPER_ADMIN' });
    const a = await request(app).get('/api/admin/analytics').set('Authorization', `Bearer ${token}`);
    assert.equal(a.status, 200);
    assert.equal(a.body.totals.businesses, 1);
    const sub = await request(app).post(`/api/admin/merchants/${bizId}/subscription`).set('Authorization', `Bearer ${token}`).send({ planId: 'platinum', cycle: '1Y' });
    assert.equal(sub.status, 201, JSON.stringify(sub.body));
    assert.match(sub.body.invoiceNo, /^MS\/\d\d-\d\d\/00001$/);
    assert.ok(sub.body.invoiceNo.length <= 16);
    assert.equal(sub.body.gstAmount, 1259.82); // 18% of 6,999
    // Platinum includes e-invoicing → mock IRN, flagged
    const irn = await request(app).post(`/api/invoices/${invoiceId}/einvoice`).set(auth());
    assert.equal(irn.status, 200, JSON.stringify(irn.body));
    assert.equal(irn.body.mock, true);
    assert.equal(irn.body.irn.length, 64);
  });

  test('reports respond', async () => {
    for (const path of ['/api/reports/gstr1', '/api/reports/pnl', '/api/reports/ageing?kind=payables', '/api/reports/daybook', '/api/reports/dashboard']) {
      const r = await request(app).get(path).set(auth());
      assert.equal(r.status, 200, `${path}: ${JSON.stringify(r.body)}`);
    }
    const g = (await request(app).get('/api/reports/gstr1').set(auth())).body;
    assert.equal(g.b2b.length, 3);
    assert.equal(g.cdnr.length, 1);
  });
});

describe('Phase 1: invoice extras, GSTR-1 JSON, import, export', () => {
  let h: Record<string, string> = {};
  let customerId = '';
  let productId = '';

  test('setup business', async () => {
    const s = await login('9810000020');
    const b = await request(app).post('/api/businesses').set('Authorization', `Bearer ${s.accessToken}`).send({ name: 'Extras Traders', gstin: gstin('07', 'AAACE4321F'), stateCode: '07' });
    assert.equal(b.status, 201, JSON.stringify(b.body));
    h = { Authorization: `Bearer ${s.accessToken}`, 'X-Business-Id': b.body._id };
  });

  test('CSV import: valid rows created, bad rows reported with row numbers', async () => {
    const parties = await request(app).post('/api/parties/import').set(h).send({
      rows: [
        { Type: 'Customer', Name: 'Import Buyer UP', GSTIN: BUYER_UP, Phone: '9811111111', Address: 'Noida' },
        { Type: 'Customer', Name: 'Bad GSTIN Co', GSTIN: '09ABCDE1234F1Z0' },
        { Type: 'Supplier', Name: 'Local Supplier', 'State Code': '7' }
      ]
    });
    assert.equal(parties.status, 200, JSON.stringify(parties.body));
    assert.equal(parties.body.created, 2);
    assert.equal(parties.body.errors[0].row, 3);
    const items = await request(app).post('/api/products/import').set(h).send({
      rows: [
        { 'Item Name': 'LED Bulb 9W', HSN: '8539', 'Selling Price': '₹ 1,180', 'GST %': '18%', 'Opening Stock': '100' },
        { 'Item Name': 'No HSN item', HSN: '12', 'Selling Price': '10' }
      ]
    });
    assert.equal(items.body.created, 1, JSON.stringify(items.body));
    assert.equal(items.body.errors.length, 1);
    customerId = (await request(app).get('/api/parties?type=CUSTOMER').set(h)).body.items[0]._id;
    productId = (await request(app).get('/api/products').set(h)).body.items[0]._id;
  });

  test('invoice: tax-inclusive price, bill discount, freight and TCS', async () => {
    const r = await request(app)
      .post('/api/invoices')
      .set(h)
      .send({
        partyId: customerId,
        items: [{ productId, quantity: 10, price: 1180, priceIncludesTax: true }],
        billDiscount: 1000,
        charges: [{ label: 'Freight', amount: 500 }],
        tcsRate: 0.1,
        shippingAddress: 'Site 4, Sector 62, Noida',
        poNumber: 'PO-7781',
        transport: { mode: 'ROAD', vehicleNumber: 'up16ab1234', transporterName: 'VRL' }
      });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    // 10 × 1,180 incl. 18% = 10,000 taxable, − 1,000 discount = 9,000, + freight 500 = 9,500 taxable
    assert.equal(r.body.items[0].taxableAmount, 9000);
    assert.equal(r.body.taxableTotal, 9500);
    assert.equal(r.body.igstTotal, 1710); // 18% inter-state
    assert.equal(r.body.tcsAmount, 11.21); // 0.1% of 11,210
    assert.equal(r.body.grandTotal, 11221);
    assert.equal(r.body.transport.vehicleNumber, 'UP16AB1234');
  });

  test('payment with TDS deducted by the customer settles the invoice', async () => {
    const inv = (await request(app).get('/api/invoices').set(h)).body.items[0];
    const r = await request(app).post('/api/payments').set(h).send({ type: 'PAYMENT_IN', partyId: customerId, invoiceId: inv._id, amount: 11126, tdsAmount: 95, mode: 'NEFT_RTGS' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const after = (await request(app).get(`/api/invoices/${inv._id}`).set(h)).body;
    assert.equal(after.status, 'PAID');
    assert.equal(after.tdsDeducted, 95);
  });

  test('GSTR-1 JSON follows the portal shape', async () => {
    const r = await request(app).get('/api/reports/gstr1/json').set(h);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.fp, /^\d{6}$/);
    assert.equal(r.body.b2b[0].ctin, BUYER_UP);
    const inv = r.body.b2b[0].inv[0];
    assert.match(inv.idt, /^\d\d-\d\d-\d{4}$/);
    assert.equal(inv.pos, '09');
    assert.equal(inv.itms[0].itm_det.rt, 18);
    assert.equal(inv.itms[0].itm_det.txval, 9500); // goods + freight at 18%
    assert.equal(r.body.hsn.data[0].hsn_sc, '8539');
  });

  test('data export and owner-only deletion request', async () => {
    const ex = await request(app).get('/api/businesses/current/export').set(h);
    assert.equal(ex.status, 200);
    assert.equal(ex.body.invoices.length, 1);
    const wrong = await request(app).post('/api/businesses/current/deletion-request').set(h).send({ confirmName: 'nope' });
    assert.equal(wrong.status, 400);
    const ok = await request(app).post('/api/businesses/current/deletion-request').set(h).send({ confirmName: 'Extras Traders' });
    assert.equal(ok.status, 200);
    const blocked = await request(app).get('/api/invoices').set(h);
    assert.equal(blocked.status, 403);
  });
});

describe('Phase 2: recurring, books, GSTR-2B, public link, Tally, export', () => {
  let h: Record<string, string> = {};
  let customerId = '';
  let supplierId = '';
  let productId = '';
  let billNo = '';
  const SUP = gstin('07', 'AAACV7777Q');

  test('setup', async () => {
    const s = await login('9810000030');
    const b = await request(app).post('/api/businesses').set('Authorization', `Bearer ${s.accessToken}`).send({ name: 'Phase Two Pvt Ltd', gstin: gstin('07', 'AAACP2222P'), stateCode: '07' });
    h = { Authorization: `Bearer ${s.accessToken}`, 'X-Business-Id': b.body._id };
    customerId = (await request(app).post('/api/parties').set(h).send({ type: 'CUSTOMER', name: 'Monthly AMC Client', gstin: BUYER_UP, stateCode: '09' })).body._id;
    supplierId = (await request(app).post('/api/parties').set(h).send({ type: 'SUPPLIER', name: 'Verified Supplier', gstin: SUP, stateCode: '07' })).body._id;
    productId = (await request(app).post('/api/products').set(h).send({ name: 'AMC Service', hsnCode: '998719', taxRate: 18, sellingPrice: 5000, isService: true })).body._id;
    const stock = (await request(app).post('/api/products').set(h).send({ name: 'Copper Wire', hsnCode: '8544', taxRate: 18, purchasePrice: 100, sellingPrice: 150 })).body._id;
    const bill = await request(app).post('/api/documents').set(h).send({ docType: 'PURCHASE_BILL', partyId: supplierId, reference: 'VS/0042', items: [{ productId: stock, quantity: 10 }] });
    billNo = bill.body.reference;
    await request(app).post('/api/payments').set(h).send({ type: 'PAYMENT_OUT', partyId: supplierId, billId: bill.body._id, amount: 500, mode: 'CASH' });
  });

  test('recurring invoice is raised once per period', async () => {
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const r = await request(app).post('/api/recurring').set(h).send({ name: 'AMC monthly', partyId: customerId, items: [{ productId, quantity: 1 }], frequency: 'MONTHLY', startOn: today });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const run = await request(app).post('/api/recurring/run').set(h);
    assert.equal(run.body.length, 1, JSON.stringify(run.body));
    assert.match(run.body[0].invoice, /^INV\//);
    const again = await request(app).post('/api/recurring/run').set(h);
    assert.equal(again.body.length, 0, 'must not bill the same period twice');
    const list = (await request(app).get('/api/recurring').set(h)).body;
    assert.equal(list[0].runs, 1);
    assert.ok(list[0].nextRunOn > today);
  });

  test('cash book and statements', async () => {
    await request(app).patch('/api/books/opening').set(h).send({ cash: 10000, bank: 50000, asOn: '2026-04-01' });
    const cash = await request(app).get('/api/books/cash?from=2026-04-01').set(h);
    assert.equal(cash.status, 200, JSON.stringify(cash.body));
    assert.equal(cash.body.opening, 10000);
    assert.equal(cash.body.closing, 9500);
    const st = await request(app).get('/api/books/statements').set(h);
    assert.equal(st.status, 200, JSON.stringify(st.body));
    assert.equal(st.body.balanceSheet.assets.stock, 1000);
    const tb = st.body.trialBalance.rows;
    const dr = tb.reduce((a: number, r: { dr: number }) => a + r.dr, 0);
    const cr = tb.reduce((a: number, r: { cr: number }) => a + r.cr, 0);
    assert.ok(Math.abs(dr - cr) < 0.01, 'trial balance must balance');
  });

  test('GSTR-2B reconciliation finds matched and missing invoices', async () => {
    const now = new Date(Date.now() + 5.5 * 3600e3);
    const rtnprd = String(now.getUTCMonth() + 1).padStart(2, '0') + now.getUTCFullYear();
    const r = await request(app).post('/api/gstr2b/reconcile').set(h).send({
      data: {
        rtnprd,
        docdata: {
          b2b: [
            { ctin: SUP, trdnm: 'Verified Supplier', inv: [{ inum: 'vs-42', dt: '01-11-2026', val: 1180, itcavl: 'Y', items: [{ rt: 18, txval: 1000, cgst: 90, sgst: 90 }] }] },
            { ctin: gstin('27', 'AAACZ9999Z'), trdnm: 'Unknown Mumbai', inv: [{ inum: 'MUM/1', dt: '02-11-2026', val: 590, items: [{ igst: 90 }] }] }
          ]
        }
      }
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.summary.matched, 1, `"vs-42" should match bill "${billNo}"`);
    assert.equal(r.body.summary.missingInBooks, 1);
  });

  test('public invoice link works without login and hides internal data', async () => {
    const inv = (await request(app).get('/api/invoices').set(h)).body.items[0];
    const share = await request(app).post(`/api/invoices/${inv._id}/share`).set(h);
    assert.equal(share.status, 200);
    const pub = await request(app).get(`/api/public/invoices/${share.body.token}`);
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(pub.body.invoice.number, inv.number);
    assert.equal(pub.body.invoice.createdBy, undefined);
    assert.equal((await request(app).get('/api/public/invoices/not-a-real-token-123456789')).status, 404);
  });

  test('Tally XML export', async () => {
    const r = await request(app).get('/api/tally/vouchers.xml').set(h);
    assert.equal(r.status, 200);
    assert.match(r.text, /<VOUCHER VCHTYPE="Sales"/);
    assert.match(r.text, /<VOUCHER VCHTYPE="Purchase"/);
    assert.match(r.text, /<VOUCHER VCHTYPE="Payment"/);
  });

  test('export under LUT is zero-rated with the Rule 46 endorsement', async () => {
    const noLut = await request(app).post('/api/invoices').set(h).send({ walkIn: { name: 'Acme Inc, USA', stateCode: '96', address: 'NY' }, supplyType: 'EXPORT_WOPAY', items: [{ productId, quantity: 2 }] });
    assert.equal(noLut.status, 400);
    const r = await request(app)
      .post('/api/invoices')
      .set(h)
      .send({ walkIn: { name: 'Acme Inc, USA', stateCode: '96', address: 'NY' }, supplyType: 'EXPORT_WOPAY', exportDetails: { lutNumber: 'AD070326000123X', currency: 'USD', exchangeRate: 83.5, portCode: 'INDEL4' }, items: [{ productId, quantity: 2 }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.igstTotal, 0);
    assert.equal(r.body.items[0].gstRate, 18);
    assert.equal(r.body.placeOfSupply, '96');
    assert.match(r.body.notes, /WITHOUT PAYMENT OF INTEGRATED TAX/);
    assert.equal(r.body.exportDetails.foreignValue, 119.76);
    const g = await request(app).get('/api/reports/gstr1/json').set(h);
    assert.equal(g.body.exp[0].exp_typ, 'WOPAY');
  });
});

describe('Phase 2b: godowns, batches, price lists, barcode', () => {
  let h: Record<string, string> = {};
  let customerId = '';
  let supplierId = '';
  let medId = '';
  let fanId = '';
  const day = (n: number) => new Date(Date.now() + 5.5 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);

  test('setup', async () => {
    const s = await login('9810000040');
    const b = await request(app).post('/api/businesses').set('Authorization', `Bearer ${s.accessToken}`).send({ name: 'Inventory Pharma', gstin: gstin('07', 'AAACI3333I'), stateCode: '07' });
    h = { Authorization: `Bearer ${s.accessToken}`, 'X-Business-Id': b.body._id };
    customerId = (await request(app).post('/api/parties').set(h).send({ type: 'CUSTOMER', name: 'City Chemist', stateCode: '07' })).body._id;
    supplierId = (await request(app).post('/api/parties').set(h).send({ type: 'SUPPLIER', name: 'Pharma Distributor', gstin: gstin('07', 'AAACD4444D'), stateCode: '07' })).body._id;
    medId = (await request(app).post('/api/products').set(h).send({ name: 'Paracetamol 650 (strip)', hsnCode: '30049099', taxRate: 12, purchasePrice: 20, sellingPrice: 32, trackBatches: true, barcode: '8901234567890' })).body._id;
    fanId = (await request(app).post('/api/products').set(h).send({ name: 'Table Fan', hsnCode: '8414', taxRate: 18, purchasePrice: 900, sellingPrice: 1400, openingStock: 10 })).body._id;
    assert.ok(medId && fanId);
  });

  test('batch-tracked purchase needs a batch number; batches are created with expiry', async () => {
    const missing = await request(app).post('/api/documents').set(h).send({ docType: 'PURCHASE_BILL', partyId: supplierId, reference: 'PD/1', items: [{ productId: medId, quantity: 10 }] });
    assert.equal(missing.status, 400);
    const r = await request(app).post('/api/documents').set(h).send({
      docType: 'PURCHASE_BILL', partyId: supplierId, reference: 'PD/1',
      items: [{ productId: medId, quantity: 10, batchNo: 'b-late', expiryDate: day(300) }, { productId: medId, quantity: 5, batchNo: 'B-SOON', expiryDate: day(20) }, { productId: medId, quantity: 4, batchNo: 'B-OLD', expiryDate: day(-5) }]
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const batches = (await request(app).get(`/api/batches?productId=${medId}`).set(h)).body;
    assert.equal(batches.length, 3);
    const exp = (await request(app).get('/api/batches/expiring?days=60').set(h)).body;
    assert.equal(exp.rows.length, 2);
    assert.ok(exp.rows.some((x: { expired: boolean }) => x.expired));
  });

  test('sale picks batches first-expiry-first-out and skips expired stock', async () => {
    const r = await request(app).post('/api/invoices').set(h).send({ partyId: customerId, items: [{ productId: medId, quantity: 8 }] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(r.body.items[0].batches.map((x: { batchNo: string; quantity: number }) => [x.batchNo, x.quantity]), [['B-SOON', 5], ['B-LATE', 3]]);
    const tooMuch = await request(app).post('/api/invoices').set(h).send({ partyId: customerId, items: [{ productId: medId, quantity: 10 }] });
    assert.equal(tooMuch.status, 400, 'only 7 unexpired strips left');
    const cancel = await request(app).post(`/api/invoices/${r.body._id}/cancel`).set(h).send({ reason: 'Wrong customer' });
    assert.equal(cancel.status, 200);
    const batches = (await request(app).get(`/api/batches?productId=${medId}`).set(h)).body;
    assert.equal(batches.find((x: { batchNo: string }) => x.batchNo === 'B-SOON').quantity, 5, 'cancel restores the same batches');
  });

  test('godown transfer keeps the total and moves stock', async () => {
    const shop = await request(app).post('/api/godowns').set(h).send({ name: 'Shop counter' });
    assert.equal(shop.status, 201);
    const godowns = (await request(app).get('/api/godowns').set(h)).body;
    const main = godowns.find((g: { isDefault: boolean }) => g.isDefault);
    const t = await request(app).post('/api/godowns/transfer').set(h).send({ productId: fanId, fromGodownId: main._id, toGodownId: shop.body._id, quantity: 4 });
    assert.equal(t.status, 200, JSON.stringify(t.body));
    const tooMuch = await request(app).post('/api/godowns/transfer').set(h).send({ productId: fanId, fromGodownId: shop.body._id, toGodownId: main._id, quantity: 9 });
    assert.equal(tooMuch.status, 400);
    const sale = await request(app).post('/api/invoices').set(h).send({ partyId: customerId, godownId: shop.body._id, items: [{ productId: fanId, quantity: 3 }] });
    assert.equal(sale.status, 201, JSON.stringify(sale.body));
    const shopStock = (await request(app).get(`/api/godowns/${shop.body._id}/stock`).set(h)).body.items;
    assert.equal(shopStock[0].quantity, 1);
    const fan = (await request(app).get('/api/products').set(h)).body.items.find((p: { _id: string }) => p._id === fanId);
    assert.equal(fan.stock, 7);
  });

  test('party price list applies when no price is sent; barcode lookup', async () => {
    const pl = await request(app).post('/api/price-lists').set(h).send({ name: 'Wholesale', items: [{ productId: fanId, price: 1250 }] });
    assert.equal(pl.status, 201);
    await request(app).patch(`/api/parties/${customerId}`).set(h).send({ priceListId: pl.body._id });
    const resolved = (await request(app).get(`/api/price-lists/resolve?partyId=${customerId}`).set(h)).body;
    assert.equal(resolved.prices[fanId], 1250);
    const inv = await request(app).post('/api/invoices').set(h).send({ partyId: customerId, items: [{ productId: fanId, quantity: 1 }] });
    assert.equal(inv.body.items[0].price, 1250);
    const scan = await request(app).get('/api/products/by-barcode/8901234567890').set(h);
    assert.equal(scan.body._id, medId);
  });
});
