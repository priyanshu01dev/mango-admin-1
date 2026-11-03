# Deploying Mango Invoice

One Docker container serves the API **and** the web app (same origin, `STATIC_DIR=/app/dist`).
The database is MongoDB Atlas. Recommended region for both: **AWS Mumbai (ap-south-1)**, so data stays in India.

## 1. Database: MongoDB Atlas
1. Create a cluster: M10 or higher for production (M0 Free for staging), AWS / Mumbai.
2. Database Access: a user with *read and write to any database*.
3. Network Access: the outbound IP(s) of your hosting. Avoid `0.0.0.0/0` in production.
4. Backups: turn on continuous cloud backup (M10+).
5. Connection string → `MONGODB_URI` (keep `/mango_invoice` before the `?`). Check it with `npm run db:check`.

## 2. Environment variables
Copy `.env.example` and set everything for production. The server **refuses to start** if any of these is unsafe:

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two different random 48+ character values |
| `APP_URL`, `CORS_ORIGINS` | `https://app.yourdomain.in` |
| `SMS_PROVIDER` | `msg91`, plus `MSG91_AUTH_KEY` and `MSG91_OTP_TEMPLATE_ID` (DLT-approved) |
| `GSP_MODE` | `disabled` until a GSP is connected (merchants use the portal JSON flow meanwhile) |
| `RAZORPAY_*` | live keys + webhook secret |
| `SMTP_*` | email sender |
| `WHATSAPP_*` | Meta Cloud API token, phone number id, approved template names |
| `PLATFORM_LEGAL_NAME`, `PLATFORM_GSTIN`, `PLATFORM_STATE_CODE` | your company's GST registration (printed on subscription invoices) |

Keep secrets in the host's secret manager (AWS Secrets Manager / App Runner secrets), never in git.

## 3. Build and run
```bash
docker build -t mango-invoice \
  --build-arg VITE_COMPANY_NAME="Your Company Pvt Ltd" \
  --build-arg VITE_COMPANY_ADDRESS="Full registered address" \
  --build-arg VITE_SUPPORT_EMAIL="support@yourdomain.in" \
  --build-arg VITE_SUPPORT_PHONE="+91 ..." \
  --build-arg VITE_GRIEVANCE_OFFICER="Name" \
  --build-arg VITE_GRIEVANCE_EMAIL="grievance@yourdomain.in" \
  --build-arg VITE_JURISDICTION_CITY="Raipur" .
docker run -p 4000:4000 --env-file .env.production mango-invoice
# first time only: plans, feature flags, compliance rules, super admin
docker run --rm --env-file .env.production -e SEED_ADMIN_EMAIL=you@yourdomain.in -e SEED_ADMIN_PASSWORD='long-unique-password' mango-invoice node dist-server/seed.js
```
Any container host works. Two common choices:
- **AWS App Runner (ap-south-1):** push the image to ECR, create a service on port 4000, health check `/api/health`, then attach the custom domain (HTTPS certificate is automatic).
- **Railway / Render / Fly.io:** deploy from the Dockerfile. Check the region; Mumbai keeps data residency simple.

Run **one** instance at first. The scheduler (recurring invoices, reminders, broadcasts) is safe with more instances because jobs are claimed atomically.

## 4. After the first deploy
- [ ] `https://app.yourdomain.in/api/health` returns `{"ok":true,"db":"connected"}`
- [ ] Razorpay dashboard → Webhooks: `https://app.yourdomain.in/api/webhooks/razorpay`, events `order.paid`, `payment.captured`, `payment_link.paid`, with the same secret as `RAZORPAY_WEBHOOK_SECRET`
- [ ] Log in as the super admin, open Integrations & GSP: every service you configured shows CONNECTED
- [ ] OTP login on a real phone, create a business, raise an invoice, print it, pay a ₹1 payment link
- [ ] `/privacy`, `/terms`, `/refund-policy`, `/contact`, `/delete-account` show your company details (no DRAFT banner)
- [ ] Browser tests against staging: `E2E_BASE_URL=https://staging... npm run e2e` (needs a dev-mode server for OTP codes; run them on staging, not production)

## 5. Launch checklist: things only the business can do
| Item | Why |
|---|---|
| Company incorporation + GST registration | needed for Razorpay KYC and for GST invoices on subscriptions |
| Domain name | `app.yourdomain.in`, plus a support email on that domain |
| MSG91 account + DLT registration (entity, sender id, OTP template) | OTP login; usually takes several days |
| Razorpay account + KYC (live mode) | plan purchases and invoice payment links |
| Meta Business verification + WhatsApp templates | reminders and broadcasts on WhatsApp (optional at launch) |
| GSP contract (IRIS, Masters India, Vayana…) | direct e-invoice / e-way bill; until then the portal JSON flow works |
| Lawyer review of `/privacy`, `/terms`, `/refund-policy` | the pages are templates |
| Grievance officer name and email | required on the policy and contact pages |
| Play Console account (when the Android app is ready) | needs the `/delete-account` and `/privacy` URLs |

## Operations
- Logs: one JSON line per request (`id`, `method`, `path`, `status`, `ms`). Every response has an `X-Request-Id` to quote in support tickets.
- Health: `GET /api/health` (returns 503 when the database is down).
- Data export for a merchant: Settings → Store Profile → Export. Account deletion: `/delete-account`.
