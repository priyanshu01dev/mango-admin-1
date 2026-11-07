/**
 * The raw app Snapshot as the phone syncs it (PUT /api/v1/sync), limited to the parts the
 * feature screens read. Mirrors MangoInvoice/app/.../data/Models.kt, Hospitality.kt and Extras.kt.
 * Dates are "YYYY-MM-DD" strings, timestamps are epoch milliseconds.
 */

export type ISODate = string;

export interface SnapParty { id: string; name: string; phone: string; email: string; type: 'CUSTOMER' | 'SUPPLIER'; group: string }
export interface SnapDoc {
  id: string; type: string; number: string; partyId: string; partyName: string; date: ISODate; amount: number; paid: number;
  status: string; orderId?: string | null; bookingId?: string | null;
}
export interface SnapExpense { id: string; category: string; payee: string; amount: number; date: ISODate; scope?: 'BUSINESS' | 'PERSONAL' }
export interface SnapItem { id: string; name: string; salePrice: number; menuCategory?: string; foodType?: string; available?: boolean }

// ── Restaurant & hotel ──
export interface DiningTable { id: string; name: string; area: string; seats: number }
export interface OrderLine { id: string; name: string; variant?: string; qty: number; rate: number; kotQty?: number }
export interface RunningOrder {
  id: string; number: number; tableId?: string | null; type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'; lines: OrderLine[]; date: ISODate; openedAt: number;
  customerName?: string; status: 'OPEN' | 'BILLED' | 'POSTED_TO_ROOM' | 'CLOSED' | 'MERGED' | 'VOID'; billDocIds?: string[]; bookingId?: string | null;
}
export interface KotLine { name: string; variant?: string; qty: number; note?: string }
export interface Kot { id: string; number: number; orderId: string; date: ISODate; at: number; tableName: string; orderType: string; lines: KotLine[]; cancel: boolean; reason?: string; prints?: number }
export interface Room { id: string; number: string; type: string; tariff: number; status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE'; floor?: string; maxGuests?: number }
export interface Booking {
  id: string; roomId: string; partyId: string; guestName: string; phone?: string; checkIn: ISODate; checkOut: ISODate; adults: number; children: number;
  tariff: number; advance: number; idProofType?: string; idProofNumber?: string; status: 'RESERVED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED'; invoiceId?: string | null;
}

// ── Staff ──
export type StaffPermission = 'BILLING' | 'POS' | 'RESTAURANT' | 'HOTEL' | 'ITEMS' | 'PARTIES' | 'EXPENSES' | 'VISITS' | 'DELIVERY';
export interface StaffMember {
  id: string; name: string; phone: string; role: string; permissions: StaffPermission[]; salaryType: 'MONTHLY' | 'DAILY'; salary: number;
  joinedOn?: ISODate | null; active: boolean; trackLocation: boolean; lastLoginAt: number;
}
export interface Punch { at: number; lat?: number | null; lng?: number | null; distanceM?: number | null; selfie?: string }
export type AttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'PAID_LEAVE' | 'ABSENT';
export interface AttendanceEntry { id: string; staffId: string; date: ISODate; checkIn?: Punch | null; checkOut?: Punch | null; status: AttendanceStatus; corrected: boolean; note?: string }
export interface StoreVisit { id: string; staffId: string; storeName: string; address: string; contact: string; lat?: number | null; lng?: number | null; photos: string[]; notes: string; orderValue: number; at: number }
export interface LocationPing { staffId: string; lat: number; lng: number; at: number }
export interface SalaryPayment { id: string; staffId: string; month: string; payableDays: number; gross: number; bonus: number; deductions: number; advance: number; net: number; mode: string; paidAt: number }
export interface StaffSettings { geofenceLat?: number | null; geofenceLng?: number | null; geofenceRadiusM: number; requireSelfie: boolean; ownerPinHash: string; pingEveryMin: number }

// ── Licences ──
export type LicenceKind = 'FSSAI' | 'TRADE';
export type LicenceStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'QUERY' | 'APPROVED' | 'REJECTED';
export interface Licence {
  id: string; kind: LicenceKind; action: 'NEW' | 'RENEWAL'; fssaiCategory?: 'BASIC' | 'STATE' | 'CENTRAL' | null; holderName: string; premises: string; tradeType: string;
  number: string; applicationRef: string; appliedOn?: ISODate | null; issuedOn?: ISODate | null; expiresOn?: ISODate | null; years: number; fee: number;
  status: LicenceStatus; documents: Record<string, string>; notes: string; updatedAt: number;
}

// ── Coins, AI video, ads ──
export interface CoinTxn { id: string; at: number; coins: number; reason: string; ref: string; paid: number; verified: boolean }
export interface AiVideo { id: string; title: string; prompt: string; scenes: string[]; style: string; durationSec: number; createdAt: number; coins: number }
export type AdPlatform = 'INSTAGRAM' | 'FACEBOOK' | 'YOUTUBE' | 'GOOGLE';
export interface AdAccount { platform: AdPlatform; handle: string; adAccountId: string; connected: boolean; connectedAt: number }
export interface AdCampaign {
  id: string; name: string; platforms: AdPlatform[]; objective: string; dailyBudget: number; days: number; radiusKm: number; caption: string;
  videoId?: string | null; status: 'DRAFT' | 'POSTED' | 'LIVE' | 'PAUSED' | 'ENDED'; createdAt: number; startedOn?: ISODate | null; spend: number; reach: number; leads: number;
}

// ── Loyalty & card ──
export interface LoyaltySettings { enabled: boolean; pointsPer100: number; rupeesPerPoint: number; minRedeem: number; welcomeBonus: number; prefix: string }
export interface LoyaltyMember { partyId: string; code: string; joinedOn: ISODate }
export interface PointsEntry { id: string; partyId: string; points: number; reason: string; at: number }
export interface VisitingCard { design: string; name: string; title: string; phone: string; email: string; website: string; address: string; tagline: string }

// ── Delivery & rides ──
export type DeliveryPlatform = 'ZOMATO' | 'SWIGGY' | 'ONDC' | 'UBER' | 'OLA' | 'RAPIDO';
export interface DeliveryIntegration { platform: DeliveryPlatform; connected: boolean; outletId: string; apiKey: string; commissionPct: number; autoAccept: boolean; autoKot: boolean }
export type DeliveryStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED' | 'REJECTED';
export interface DeliveryOrder {
  id: string; platform: DeliveryPlatform; externalId: string; customerName: string; lines: { name: string; qty: number; rate: number }[];
  amount: number; commissionPct: number; status: DeliveryStatus; at: number; settled: boolean;
}
export interface RideBooking { id: string; platform: DeliveryPlatform; purpose: string; from: string; to: string; fare: number; at: number }

export interface Extras {
  staff: StaffMember[]; attendance: AttendanceEntry[]; visits: StoreVisit[]; pings: LocationPing[]; salaries: SalaryPayment[]; staffSettings: StaffSettings;
  activeStaffId?: string | null;
  licences: Licence[];
  coinTxns: CoinTxn[]; videos: AiVideo[]; adAccounts: AdAccount[]; campaigns: AdCampaign[];
  loyalty: LoyaltySettings; loyaltyMembers: LoyaltyMember[]; points: PointsEntry[];
  card: VisitingCard; plan: string; cardUnlocked: boolean;
  integrations: DeliveryIntegration[]; deliveryOrders: DeliveryOrder[]; rides: RideBooking[];
}

export interface AppSnapshot {
  business: { name: string; businessType?: 'RETAIL' | 'RESTAURANT' | 'HOTEL' | 'RESTAURANT_HOTEL'; city?: string; state?: string };
  parties: SnapParty[]; items: SnapItem[]; docs: SnapDoc[]; expenses: SnapExpense[];
  tables: DiningTable[]; orders: RunningOrder[]; kots: Kot[]; rooms: Room[]; bookings: Booking[];
  extras: Extras;
}

const EMPTY_EXTRAS: Extras = {
  staff: [], attendance: [], visits: [], pings: [], salaries: [],
  staffSettings: { geofenceRadiusM: 200, requireSelfie: true, ownerPinHash: '', pingEveryMin: 15 },
  licences: [], coinTxns: [], videos: [], adAccounts: [], campaigns: [],
  loyalty: { enabled: false, pointsPer100: 1, rupeesPerPoint: 1, minRedeem: 50, welcomeBonus: 0, prefix: '' },
  loyaltyMembers: [], points: [],
  card: { design: 'CLASSIC', name: '', title: '', phone: '', email: '', website: '', address: '', tagline: '' },
  plan: 'Free', cardUnlocked: false, integrations: [], deliveryOrders: [], rides: [],
};

/** Fills every missing list / block so screens never crash on an older app's snapshot. */
export function normalizeSnapshot(raw: any): AppSnapshot {
  const s = raw?.snapshot ?? raw ?? {};
  const x = s.extras ?? {};
  const extras: Extras = { ...EMPTY_EXTRAS, ...x,
    staffSettings: { ...EMPTY_EXTRAS.staffSettings, ...(x.staffSettings ?? {}) },
    loyalty: { ...EMPTY_EXTRAS.loyalty, ...(x.loyalty ?? {}) },
    card: { ...EMPTY_EXTRAS.card, ...(x.card ?? {}) } };
  (Object.keys(EMPTY_EXTRAS) as (keyof Extras)[]).forEach((k) => {
    if (Array.isArray(EMPTY_EXTRAS[k]) && !Array.isArray(extras[k])) (extras as any)[k] = [];
  });
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    business: s.business ?? { name: '' },
    parties: arr(s.parties), items: arr(s.items), docs: arr(s.docs), expenses: arr(s.expenses),
    tables: arr(s.tables), orders: arr(s.orders), kots: arr(s.kots), rooms: arr(s.rooms), bookings: arr(s.bookings),
    extras,
  };
}
