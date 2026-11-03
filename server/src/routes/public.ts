import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ah, notFound } from '../lib/errors';
import { Invoice } from '../models/billing';
import { Business } from '../models/core';
import { config } from '../config';

/** Customer-facing invoice link (spec §8.7 P1): view and pay without logging in. */
export const publicRouter = Router();

publicRouter.use(rateLimit({ windowMs: 60 * 1000, limit: config.NODE_ENV === 'test' ? 1000 : 60, standardHeaders: 'draft-7', legacyHeaders: false }));

publicRouter.get(
  '/invoices/:token',
  ah(async (req, res) => {
    const token = String(req.params.token);
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw notFound('Invoice');
    const inv = await Invoice.findOne({ publicToken: token }).lean();
    if (!inv) throw notFound('Invoice');
    const biz = await Business.findById(inv.businessId).lean();
    if (!biz || biz.status === 'SUSPENDED') throw notFound('Invoice');
    // only what the buyer would see on the printed invoice
    res.json({
      business: { name: biz.name, tradeName: biz.tradeName, gstin: biz.gstin, address: biz.address, city: biz.city, state: biz.state, stateCode: biz.stateCode, phone: biz.phone, email: biz.email, upiId: biz.upiId },
      invoice: {
        number: inv.number,
        kind: inv.kind,
        date: inv.date,
        dueDate: inv.dueDate,
        status: inv.status,
        partyName: inv.partyName,
        partyGstin: inv.partyGstin,
        partyAddress: inv.partyAddress,
        placeOfSupply: inv.placeOfSupply,
        isInterState: inv.isInterState,
        items: inv.items.map(i => ({ name: i.name, hsnCode: i.hsnCode, quantity: i.quantity, unit: i.unit, price: i.price, discountPercent: i.discountPercent, gstRate: i.gstRate, taxableAmount: i.taxableAmount, totalAmount: i.totalAmount })),
        charges: inv.charges,
        billDiscount: inv.billDiscount,
        taxableTotal: inv.taxableTotal,
        cgstTotal: inv.cgstTotal,
        sgstTotal: inv.sgstTotal,
        igstTotal: inv.igstTotal,
        tcsAmount: inv.tcsAmount,
        roundOff: inv.roundOff,
        grandTotal: inv.grandTotal,
        amountPaid: inv.amountPaid,
        balanceDue: inv.balanceDue,
        notes: inv.notes,
        irn: inv.eInvoice?.status === 'GENERATED' ? inv.eInvoice.irn : undefined,
        irnMock: !!inv.eInvoice?.mock
      }
    });
  })
);
