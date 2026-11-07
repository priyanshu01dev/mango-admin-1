import { useEffect, useState } from 'react';
import { useBilling } from '../context/BillingContext';
import { api, ApiError } from './api';
import {
  AppSnapshot, AttendanceEntry, Licence, LoyaltyMember, LoyaltySettings, PointsEntry, SnapDoc, StaffMember, normalizeSnapshot,
} from '../types/snapshot';

/**
 * The selected business's raw app snapshot, as last synced from the phone.
 * Backend: GET /api/admin/businesses/:id/snapshot → { snapshot, revision, updatedAt } (or the snapshot itself).
 * Cached per business and refresh tick so switching tabs doesn't refetch.
 */
const cache = new Map<string, { snap: AppSnapshot; updatedAt: string | null }>();

export interface SnapshotState { snap: AppSnapshot | null; updatedAt: string | null; loading: boolean; error: string | null; missingEndpoint: boolean }

export function useSnapshot(): SnapshotState {
  const { activeBusiness, loading: wsLoading } = useBilling();
  const id = activeBusiness.id;
  // the workspace reload (refresh button) changes lastSyncAt / loading; use both to bust the cache
  const key = `${id}|${activeBusiness.lastSyncAt ?? ''}`;
  const [state, setState] = useState<SnapshotState>(() => {
    const c = cache.get(key);
    return { snap: c?.snap ?? null, updatedAt: c?.updatedAt ?? null, loading: !c, error: null, missingEndpoint: false };
  });

  useEffect(() => {
    if (!id || wsLoading) return;
    const c = cache.get(key);
    if (c) { setState({ snap: c.snap, updatedAt: c.updatedAt, loading: false, error: null, missingEndpoint: false }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api<any>(`/businesses/${id}/snapshot`)
      .then((r) => {
        const snap = normalizeSnapshot(r);
        const updatedAt = r?.updatedAt ?? null;
        cache.set(key, { snap, updatedAt });
        if (alive) setState({ snap, updatedAt, loading: false, error: null, missingEndpoint: false });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const err = e as ApiError;
        if (err.status === 404 && err.code !== 'no_snapshot') setState({ snap: null, updatedAt: null, loading: false, error: null, missingEndpoint: true });
        else if (err.status === 404) setState({ snap: normalizeSnapshot({}), updatedAt: null, loading: false, error: null, missingEndpoint: false });
        else setState({ snap: null, updatedAt: null, loading: false, error: err.message ?? 'Failed', missingEndpoint: false });
      });
    return () => { alive = false; };
  }, [key, id, wsLoading]);

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logic mirrored from the Android app (domain/StaffLogic.kt, Loyalty.kt, Licences.kt)
// ─────────────────────────────────────────────────────────────────────────────

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const monthOf = (iso: string) => iso.slice(0, 7);
export const msToISO = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const clock = (ms?: number | null) => (ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
export const stamp = (ms?: number | null) => (ms ? new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const showDate = (iso?: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const daysBetween = (fromISO: string, toISO: string) =>
  Math.round((new Date(toISO + 'T00:00:00').getTime() - new Date(fromISO + 'T00:00:00').getTime()) / 86_400_000);
export const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const workedMinutes = (e: AttendanceEntry) => (e.checkIn && e.checkOut ? Math.round((e.checkOut.at - e.checkIn.at) / 60_000) : null);
export const hm = (m: number | null) => (m == null ? '—' : `${Math.floor(m / 60)}h ${m % 60}m`);
const paise = (v: number) => Math.round(v * 100) / 100;

export interface MonthSummary { present: number; halfDay: number; paidLeave: number; absent: number; notMarked: number; workedMinutes: number; payableDays: number }

/** Same rules as the app: days up to today without an entry are "not marked" and not paid. */
export function monthSummary(staff: StaffMember, month: string, entries: AttendanceEntry[], today = todayISO()): MonthSummary {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const mine = new Map(entries.filter((e) => e.staffId === staff.id && monthOf(e.date) === month).map((e) => [e.date, e]));
  const s: MonthSummary = { present: 0, halfDay: 0, paidLeave: 0, absent: 0, notMarked: 0, workedMinutes: 0, payableDays: 0 };
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    if (iso > today) break;
    if (staff.joinedOn && iso < staff.joinedOn) continue;
    const e = mine.get(iso);
    if (!e) { s.notMarked++; continue; }
    if (e.status === 'PRESENT') s.present++; else if (e.status === 'HALF_DAY') s.halfDay++; else if (e.status === 'PAID_LEAVE') s.paidLeave++; else s.absent++;
    s.workedMinutes += workedMinutes(e) ?? 0;
  }
  s.payableDays = s.present + s.paidLeave + s.halfDay * 0.5;
  return s;
}

export function grossSalary(staff: StaffMember, month: string, sum: MonthSummary) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  return paise(staff.salaryType === 'DAILY' ? staff.salary * sum.payableDays : (staff.salary / days) * sum.payableDays);
}

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6_371_000, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function routeUrl(points: { lat: number; lng: number; at: number }[]) {
  const p = [...points].sort((a, b) => a.at - b.at);
  if (p.length === 0) return null;
  if (p.length === 1) return mapsUrl(p[0].lat, p[0].lng);
  const mid = p.slice(1, -1);
  const step = Math.max(1, Math.floor(mid.length / 8));
  const way = mid.filter((_, i) => i % step === 0).slice(0, 8).map((x) => `${x.lat},${x.lng}`).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&origin=${p[0].lat},${p[0].lng}&destination=${p[p.length - 1].lat},${p[p.length - 1].lng}${way ? `&waypoints=${way}` : ''}&travelmode=driving`;
}

const EARN = new Set(['INVOICE', 'BILL_OF_SUPPLY']);
const REVERSE = new Set(['SALES_RETURN', 'CREDIT_NOTE']);

/** Points are derived from invoices since joining, minus stored redemptions (as in the app). */
export function loyaltyBalance(m: LoyaltyMember, settings: LoyaltySettings, docs: SnapDoc[], entries: PointsEntry[]) {
  const mine = docs.filter((d) => d.partyId === m.partyId && d.status !== 'CANCELLED' && d.date >= m.joinedOn);
  const spend = mine.filter((d) => EARN.has(d.type)).reduce((a, d) => a + d.amount, 0) - mine.filter((d) => REVERSE.has(d.type)).reduce((a, d) => a + d.amount, 0);
  const earned = Math.floor((Math.max(0, spend) / 100) * settings.pointsPer100);
  const manual = entries.filter((e) => e.partyId === m.partyId);
  const adjusted = manual.filter((e) => e.points > 0).reduce((a, e) => a + e.points, 0);
  const redeemed = -manual.filter((e) => e.points < 0).reduce((a, e) => a + e.points, 0);
  return { earned, adjusted, redeemed, balance: earned + adjusted - redeemed, spend: paise(spend) };
}

export type ExpiryState = 'NONE' | 'OK' | 'DUE_SOON' | 'RENEW_NOW' | 'EXPIRED';
export function expiryState(l: Licence, today = todayISO()): ExpiryState {
  if (!l.expiresOn) return 'NONE';
  const d = daysBetween(today, l.expiresOn);
  return d < 0 ? 'EXPIRED' : d <= 30 ? 'RENEW_NOW' : d <= 90 ? 'DUE_SOON' : 'OK';
}
export const FSSAI_LABEL: Record<string, string> = { BASIC: 'Basic registration', STATE: 'State licence', CENTRAL: 'Central licence' };
export const LICENCE_LABEL: Record<string, string> = { FSSAI: 'Food licence (FSSAI)', TRADE: 'Trade licence' };

/** Documents each application needs (same lists as the app). */
export function licenceDocuments(l: Licence): string[] {
  if (l.kind === 'FSSAI') {
    const list = ['Photo of the food business operator', 'Identity proof (Aadhaar / PAN / voter ID)', 'Proof of possession of premises (rent agreement / ownership)'];
    if (l.fssaiCategory !== 'BASIC') list.push('Blueprint / layout of the processing unit or kitchen', 'List of food categories to be handled', 'Water test report (NABL lab)', 'Food safety management system plan', 'NOC from municipality / panchayat');
    if (l.action === 'RENEWAL') list.push('Copy of current FSSAI licence / registration');
    return list;
  }
  const list = ['Identity proof of the owner', 'Address proof of the shop', 'Property tax receipt / rent agreement', 'NOC from the property owner', 'Shop photo with signboard', 'GST registration certificate (if registered)'];
  if (l.action === 'RENEWAL') list.push('Copy of current trade licence');
  return list;
}

export const PLATFORM_LABEL: Record<string, string> = {
  ZOMATO: 'Zomato', SWIGGY: 'Swiggy', ONDC: 'ONDC', UBER: 'Uber', OLA: 'Ola', RAPIDO: 'Rapido',
  INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', YOUTUBE: 'YouTube', GOOGLE: 'Google Ads',
};
export const label = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
