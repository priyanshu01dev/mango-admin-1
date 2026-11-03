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
