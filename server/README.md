# Mango Invoice API

Node 20 + Express + TypeScript + MongoDB (Mongoose). Multi-tenant: every business-scoped record carries `businessId`, and every request is checked against the caller's membership.

## Run locally

```bash
cp .env.example .env          # then set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (48+ random chars each)
npm run db:dev                # local MongoDB replica set on :27017, data in .data/mongo (no install needed)
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-long-password' npm run server:seed
npm run server:dev            # API on http://localhost:4000 (watch mode)
npm run dev                   # web app on :3000, /api is proxied to :4000
```

With `SMS_PROVIDER=console` the OTP is printed in the server log and returned as `devCode` (development only).

| Script | What it does |
| --- | --- |
| `npm run server:test` | 19 end-to-end API tests against a real MongoDB replica set |
| `npm run server:lint` | Type-check the server |
| `npm run server:build` / `server:start` | Bundle to `dist-server/index.js` and run it |

## Rules the server enforces

- **Totals are computed on the server.** Clients send items (product, qty, price, discount); GST, CGST/SGST vs IGST (from place of supply), round-off and totals are recalculated with the same code the web app uses (`shared/gst.ts`).
- **Atomic writes.** Invoice + stock + party balance + payment + audit log are one MongoDB transaction, so a failure leaves nothing half-written. MongoDB must run as a replica set.
- **Rule 46 numbering.** Atomic per-business counters, optional FY reset (`{FY}` in the prefix), max 16 characters, unique, and never reused: invoices are cancelled with a reason, not deleted.
- **Bill of supply.** Composition and unregistered sellers can't charge GST.
- **GSTIN checksum, PAN↔GSTIN and state↔GSTIN checks**, plus HSN digits by turnover band.
- **Stock can't go negative** unless the business enables it.
- **Credit and debit notes** must reference a live invoice or bill and can't exceed what is left on it. Debit notes reverse ITC only when the bill was ITC-eligible.
- **Roles:** OWNER and ADMIN can do everything. SALESMAN handles sales documents and payments in. ACCOUNTANT (CA) is read-only plus reports. Platform roles are SUPER_ADMIN and SUPPORT.
- **Plan limits** (invoices/month, users, businesses, e-invoices, e-way bills) come from the plan, including the free trial.
- **e-Invoice / e-Way bill pre-validation** checks GSTINs, HSN digits, document age, the 30-day IRP window, value thresholds, vehicle number and distance before anything is sent. `GSP_MODE=disabled` refuses to generate. `mock` produces IRNs flagged `mock: true`. Both mock modes are blocked in production.
- **Auth:** 6-digit OTP (hashed, 5-minute expiry, 5 attempts, 30-second resend gap). Email and password use bcrypt. Access JWTs last 15 minutes. Refresh tokens rotate, are stored hashed, and reusing one revokes all sessions. Login endpoints are rate-limited, Helmet is enabled, and CORS is restricted to an allow-list.

## API

All responses are JSON. Errors look like `{ "error": { "code", "message", "details?" } }`.
Business-scoped routes need `Authorization: Bearer <token>` and `X-Business-Id: <id>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/otp/request`, `/otp/verify`, `/login`, `/refresh`, `/logout` · `GET/PATCH /api/auth/me` |
| Business | `POST /api/businesses` · `GET/PATCH /api/businesses/current` · `PATCH /current/settings` · `GET/POST/DELETE /current/members` · `GET /current/flags` |
| Masters | `GET/POST /api/parties`, `PATCH /parties/:id`, `GET /parties/:id/ledger` · `GET/POST /api/products`, `PATCH /products/:id`, `POST /products/:id/adjust`, `GET /products/:id/ledger` |
| Sales | `GET/POST /api/invoices`, `GET /invoices/:id`, `POST /invoices/:id/cancel` · `GET /invoices/:id/einvoice/validate`, `POST /invoices/:id/einvoice`, `/einvoice/cancel`, `/ewaybill` |
| Documents | `GET /api/documents?type=…`, `POST /api/documents` (quotation, proforma, sales order, challan, credit note, PO, purchase bill, debit note) · `POST /documents/:id/cancel`, `/convert`, `/receive`, `/delivered` |
| Money | `GET/POST /api/payments` (in/out, against an invoice or bill, or as an advance) · `GET/POST/DELETE /api/expenses` |
| Reports | `GET /api/reports/gstr1`, `/gstr3b` (`?period=YYYY-MM`), `/pnl` (`?from&to`), `/ageing?kind=receivables\|payables`, `/daybook?date=`, `/dashboard` |
| Support & billing | `GET/POST /api/tickets`, `POST /tickets/:id/messages` · `GET /api/plans` · `POST /api/billing/quote` |
| Super admin | `/api/admin/analytics`, `/merchants` (+ `/:id`, `/status`, `/extend-trial`, `/subscription`, `/notes`), `/plans`, `/subscriptions`, `/coupons`, `/tickets`, `/flags`, `/broadcasts`, `/compliance`, `/audit` |

## Deploying

See [`../DEPLOY.md`](../DEPLOY.md): Docker image, MongoDB Atlas, environment variables, Razorpay webhook and the launch checklist.

## Still to come
- Direct GSP adapter for IRN / e-way bill and GST filing (the IRP / EWB portal JSON flow works without one)
- Push notifications and Google Play Billing (with the mobile app)
