# Mango Invoice — Admin (mango-admin-1)

Admin console for the Mango Invoice Android app, connected to `../backend`.

```bash
# 1. backend
cd ../backend && npm install && npm run dev        # http://localhost:4000
# 2. admin
cd ../mango-admin-1 && npm install && npm run dev  # http://localhost:3000
```

Sign in with the backend admin (default `admin@mangoinvoice.in` / `ChangeMe@123` — change it).

## What's live

- **Business switcher** (top-left) lists every business using the app, with search.
- Dashboard, Invoices, Quotations, e-Way/e-Invoice, Inventory, Customers & Suppliers, Payments, GST reports
  show that business's real books, as last synced from the phone.
  These are **read-only** — owners create and edit them in the app (the phone is the source of truth).
- **Subscriptions**: real Mango plans; switch a business's plan (Finance/Admin), saved on the server.
- **Audit & Settings**: business profile (view), suspend / reactivate, team from the app, and the server audit log.
- **Android REST API**: reference of the endpoints the app uses; public ones can be called live.
- Refresh button (top-right) re-fetches from the server.
- **Staff**: add admins (name, email, temporary password) and tick their screens: none, view, or edit. New admins get no screens.
  The sidebar shows only the screens an admin may open. Other screens show "No access", and edit buttons are disabled on view-only screens.
  The backend enforces the same rules on every request. Only super admins can create super admins.
- **Staff & attendance**: read-only view of the selected business's app staff, their app permissions, today's attendance, the monthly summary, visits and salary payments.

## Feature screens built on the app snapshot

These read the selected business's data **as synced from the phone** (read-only, like the books above):

- **Hotel & Restaurant**: table floor, running orders, KOTs (incl. cancellations), sales by order type, top dishes; rooms, bookings, arrivals / check-outs, 30-day occupancy and ADR. Guest ID numbers are masked.
- **Staff & Attendance** (extra section): staff the owner runs on the shop phone with PIN logins — permissions, selfie + GPS check-ins, payroll per month, salary history, store visits, and the field-staff route on Google Maps.
- **Food & Trade Licences**: the business's FSSAI / trade licences, document checklist, expiry and renewal alerts; plus the **Licence desk** — every business's assisted applications, where admins with *edit* set status and the government reference.
- **Marketing, Ads & Coins**: coin ledger and server recharge payments, ad accounts and campaigns (spend, reach, leads, cost per lead), AI videos, the digital visiting card and premium access.
- **Loyalty & Customer IDs**: members, points (derived from invoices, same rule as the app), redemptions and outstanding liability.
- **Online Orders & Rides**: Zomato / Swiggy / ONDC integrations (API keys masked), orders, commission and payouts due; Uber / Ola / Rapido rides.

New permission keys: `hospitality`, `licences`, `marketing`, `loyalty`, `delivery` (already in `backend/src/lib/permissions.ts`).

### Backend endpoints these screens use (implemented in ../backend)

| Endpoint | Returns |
|---|---|
| `GET /api/admin/businesses/:id/snapshot` | `{ snapshot, revision, updatedAt }` — the stored sync snapshot (404 with code `no_snapshot` if the business never synced) |
| `GET /api/admin/licences/applications?status=open` | `{ data: [{ id, businessId, businessName, kind, action, category, holderName, premises, tradeType, years, documents[], status, reference, note, createdAt }] }` |
| `PATCH /api/admin/licences/applications/:id` | body `{ status, reference, note }` |
| `GET /api/admin/businesses/:id/coin-orders` | `{ data: [{ id, packId, coins, amount, status, createdAt, paidAt, gatewayRef }] }` |

Against an older backend without them, each screen shows a clear "endpoint not found" note instead of failing.
