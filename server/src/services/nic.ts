import { BusinessDoc } from '../models/core';
import { InvoiceDoc } from '../models/billing';
import { r2 } from '../../../shared/gst';

/**
 * Official JSON payloads, usable without a GSP:
 *  - e-Invoice (IRP schema v1.1): upload through the IRP "Bulk Generation Tool", or send via any GSP later.
 *  - e-Way bill bulk JSON: upload on ewaybillgst.gov.in → e-Waybill → Generate Bulk.
 */

const dmySlash = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pinFrom = (...texts: (string | undefined | null)[]) => {
  for (const t of texts) {
    const m = String(t ?? '').match(/\b([1-9]\d{5})\b/);
    if (m) return Number(m[1]);
  }
  return 0;
};
const place = (addr: string, fallback: string) => (addr.split(',').map(s => s.trim()).filter(Boolean).pop() || fallback || 'NA').slice(0, 50);
const UQC: Record<string, string> = { PCS: 'PCS', NOS: 'NOS', KG: 'KGS', KGS: 'KGS', LTR: 'LTR', MTR: 'MTR', BOX: 'BOX', ROLL: 'ROL', PKT: 'PAC', SET: 'SET', DOZ: 'DOZ', BAG: 'BAG', TON: 'TON' };
const uqc = (u?: string | null) => UQC[(u ?? 'NOS').toUpperCase()] ?? 'OTH';
const SUP_TYP: Record<string, string> = { REGULAR: 'B2B', SEZ_WPAY: 'SEZWP', SEZ_WOPAY: 'SEZWOP', EXPORT_WPAY: 'EXPWP', EXPORT_WOPAY: 'EXPWOP', DEEMED_EXPORT: 'DEXP' };

export interface PayloadIssue {
  field: string;
  message: string;
}

export function eInvoicePayload(inv: InvoiceDoc, biz: BusinessDoc) {
  const issues: PayloadIssue[] = [];
  const sellerPin = pinFrom(biz.pincode, biz.address);
  const buyerPin = pinFrom((inv as { partyPincode?: string }).partyPincode, inv.partyAddress, inv.shippingAddress);
  const supplyType = (inv as { supplyType?: string }).supplyType ?? 'REGULAR';
  const isExport = supplyType.startsWith('EXPORT');
  if (!sellerPin) issues.push({ field: 'seller.pincode', message: 'Add your 6-digit PIN code in Store Profile' });
  if (!buyerPin && !isExport) issues.push({ field: 'buyer.pincode', message: "Buyer's PIN code is missing: add it to the party's address" });
  if ((biz.address ?? '').length < 3) issues.push({ field: 'seller.address', message: 'Business address is too short' });

  const charges = (inv.charges ?? []).map(c => ({
    name: c.label ?? 'Charges',
    hsnCode: /freight|transport/i.test(c.label ?? '') ? '996511' : /pack/i.test(c.label ?? '') ? '998540' : '999799',
    quantity: 1,
    unit: 'OTH',
    price: c.amount ?? 0,
    taxableAmount: c.taxableAmount ?? 0,
    gstRate: c.gstRate ?? 0,
    igstAmount: c.igstAmount ?? 0,
    cgstAmount: c.cgstAmount ?? 0,
    sgstAmount: c.sgstAmount ?? 0,
    totalAmount: c.totalAmount ?? 0,
    service: true
  }));
  const lines = [...inv.items.map(i => ({ ...i, service: i.hsnCode.startsWith('99') })), ...charges];

  const payload = {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: SUP_TYP[supplyType] ?? 'B2B', RegRev: inv.reverseCharge ? 'Y' : 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: 'INV', No: inv.number, Dt: dmySlash(inv.date) },
    SellerDtls: {
      Gstin: biz.gstin,
      LglNm: biz.name,
      ...(biz.tradeName ? { TrdNm: biz.tradeName } : {}),
      Addr1: (biz.address || 'NA').slice(0, 100),
      Loc: (biz.city || place(biz.address ?? '', biz.state ?? '')).slice(0, 50),
      Pin: sellerPin,
      Stcd: biz.stateCode,
      ...(biz.phone ? { Ph: biz.phone.replace(/\D/g, '').slice(-12) } : {}),
      ...(biz.email ? { Em: biz.email } : {})
    },
    BuyerDtls: {
      Gstin: isExport ? 'URP' : inv.partyGstin,
      LglNm: inv.partyName,
      Pos: isExport ? '96' : inv.placeOfSupply,
      Addr1: (inv.partyAddress || 'NA').slice(0, 100),
      Loc: place(inv.partyAddress ?? '', 'NA'),
      Pin: isExport ? 999999 : buyerPin,
      Stcd: isExport ? '96' : inv.partyStateCode,
      ...(inv.partyPhone ? { Ph: inv.partyPhone.replace(/\D/g, '').slice(-12) } : {})
    },
    ItemList: lines.map((l, i) => {
      const gross = r2((l.price ?? 0) * (l.quantity ?? 1));
      return {
        SlNo: String(i + 1),
        PrdDesc: (l.name ?? '').slice(0, 300),
        IsServc: l.service ? 'Y' : 'N',
        HsnCd: l.hsnCode,
        Qty: l.quantity,
        Unit: uqc(l.unit),
        UnitPrice: r2(l.price ?? 0),
        TotAmt: gross,
        Discount: r2(Math.max(0, gross - (l.taxableAmount ?? 0))),
        AssAmt: r2(l.taxableAmount ?? 0),
        GstRt: l.gstRate,
        IgstAmt: r2(l.igstAmount ?? 0),
        CgstAmt: r2(l.cgstAmount ?? 0),
        SgstAmt: r2(l.sgstAmount ?? 0),
        CesRt: 0,
        CesAmt: 0,
        TotItemVal: r2(l.totalAmount ?? 0)
      };
    }),
    ValDtls: {
      AssVal: r2(inv.taxableTotal),
      CgstVal: r2(inv.cgstTotal),
      SgstVal: r2(inv.sgstTotal),
      IgstVal: r2(inv.igstTotal),
      CesVal: 0,
      OthChrg: r2((inv as { tcsAmount?: number }).tcsAmount ?? 0),
      RndOffAmt: r2(inv.roundOff),
      TotInvVal: r2(inv.grandTotal)
    },
    ...(isExport
      ? {
          ExpDtls: {
            ...((inv as { exportDetails?: { shippingBillNo?: string } }).exportDetails?.shippingBillNo ? { ShipBNo: (inv as { exportDetails?: { shippingBillNo?: string } }).exportDetails!.shippingBillNo } : {}),
            ...((inv as { exportDetails?: { portCode?: string } }).exportDetails?.portCode ? { Port: (inv as { exportDetails?: { portCode?: string } }).exportDetails!.portCode } : {}),
            ForCur: (inv as { exportDetails?: { currency?: string } }).exportDetails?.currency || 'INR',
            RefClm: supplyType === 'EXPORT_WPAY' ? 'Y' : 'N'
          }
        }
      : {})
  };
  return { payload, issues };
}

export function eWayBillPayload(inv: InvoiceDoc, biz: BusinessDoc, transport: { distanceKm: number; vehicleNumber?: string; transporterId?: string; transporterName?: string }) {
  const issues: PayloadIssue[] = [];
  const fromPin = pinFrom(biz.pincode, biz.address);
  const toPin = pinFrom((inv as { partyPincode?: string }).partyPincode, inv.shippingAddress, inv.partyAddress);
  if (!fromPin) issues.push({ field: 'from.pincode', message: 'Add your 6-digit PIN code in Store Profile' });
  if (!toPin) issues.push({ field: 'to.pincode', message: "Delivery PIN code is missing in the buyer's / ship-to address" });
  const rate = (l: { gstRate: number }) => l.gstRate;
  const bill = {
    userGstin: biz.gstin,
    supplyType: 'O',
    subSupplyType: 1,
    docType: 'INV',
    docNo: inv.number,
    docDate: dmySlash(inv.date),
    fromGstin: biz.gstin,
    fromTrdName: biz.tradeName || biz.name,
    fromAddr1: (biz.address || '').slice(0, 120),
    fromPlace: (biz.city || '').slice(0, 50),
    fromPincode: fromPin,
    fromStateCode: Number(biz.stateCode),
    actualFromStateCode: Number(biz.stateCode),
    toGstin: inv.partyGstin || 'URP',
    toTrdName: inv.partyName,
    toAddr1: (inv.shippingAddress || inv.partyAddress || '').slice(0, 120),
    toPlace: place(inv.shippingAddress || inv.partyAddress || '', 'NA'),
    toPincode: toPin,
    toStateCode: Number(inv.partyStateCode),
    actualToStateCode: Number(inv.partyStateCode),
    totalValue: r2(inv.taxableTotal),
    cgstValue: r2(inv.cgstTotal),
    sgstValue: r2(inv.sgstTotal),
    igstValue: r2(inv.igstTotal),
    cessValue: 0,
    OthValue: r2(((inv as { tcsAmount?: number }).tcsAmount ?? 0) + inv.roundOff),
    totInvValue: r2(inv.grandTotal),
    transMode: 1,
    transDistance: Math.round(transport.distanceKm),
    ...(transport.transporterId ? { transporterId: transport.transporterId } : {}),
    ...(transport.transporterName ? { transporterName: transport.transporterName } : {}),
    ...(transport.vehicleNumber ? { vehicleNo: transport.vehicleNumber.replace(/[\s-]/g, '').toUpperCase(), vehicleType: 'R' } : {}),
    itemList: inv.items.map((l, i) => ({
      itemNo: i + 1,
      productName: l.name.slice(0, 100),
      productDesc: l.name.slice(0, 100),
      hsnCode: Number(l.hsnCode),
      quantity: l.quantity,
      qtyUnit: uqc(l.unit),
      taxableAmount: r2(l.taxableAmount ?? 0),
      sgstRate: inv.isInterState ? 0 : rate(l) / 2,
      cgstRate: inv.isInterState ? 0 : rate(l) / 2,
      igstRate: inv.isInterState ? rate(l) : 0,
      cessRate: 0
    }))
  };
  return { payload: { version: '1.0.0621', billLists: [bill] }, issues };
}
