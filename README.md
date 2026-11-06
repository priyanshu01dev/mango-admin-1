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
