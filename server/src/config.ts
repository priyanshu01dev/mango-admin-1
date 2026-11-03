import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/mango_invoice?replicaSet=rs0'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  // OTP delivery: "console" prints the code to the server log (dev only), "msg91" sends a real SMS
  SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_OTP_TEMPLATE_ID: z.string().optional(),
  // e-Invoice / e-Way bill: "disabled" refuses, "mock" returns clearly-marked MOCK IRNs (never in production)
  GSP_MODE: z.enum(['disabled', 'mock']).default('disabled'),
  // public URL of the web app (links in emails / WhatsApp / payment callbacks)
  APP_URL: z.string().default('http://localhost:3000'),
  // Razorpay: subscriptions checkout, invoice payment links, webhooks
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  // SMTP email (invoices, CA reports, reminders)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Mango Invoice <no-reply@mangoinvoice.in>'),
  // WhatsApp Business Cloud API (Meta) with approved templates
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_REMINDER_TEMPLATE: z.string().default('payment_reminder'),
  WHATSAPP_BROADCAST_TEMPLATE: z.string().default('announcement'),
  // MSG91 transactional SMS (DLT template ids)
  MSG91_REMINDER_TEMPLATE_ID: z.string().optional(),
  MSG91_BROADCAST_TEMPLATE_ID: z.string().optional(),
  // the platform's own GST registration, printed on subscription invoices
  PLATFORM_LEGAL_NAME: z.string().default('First Wave Technologies'),
  PLATFORM_GSTIN: z.string().default(''),
  PLATFORM_STATE_CODE: z.string().default('22'),
  // 32-byte key (base64) for encrypting stored third-party credentials (AES-256-GCM)
  SECRETS_KEY: z.string().optional(),
  // folder with the built web app (vite build → dist); served by the API in production
  STATIC_DIR: z.string().default(''),
  TRIAL_DAYS: z.coerce.number().default(7),
  TRIAL_PLAN: z.enum(['silver', 'gold', 'platinum']).default('gold')
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid server environment:\n' + parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const config = parsed.data;

/** Refuses to start in production with settings that are only safe on a laptop. */
export function productionProblems(c: typeof config) {
  const p: string[] = [];
  if (c.SMS_PROVIDER === 'console') p.push('SMS_PROVIDER=console: OTPs would be printed instead of sent. Configure MSG91.');
  if (c.SMS_PROVIDER === 'msg91' && (!c.MSG91_AUTH_KEY || !c.MSG91_OTP_TEMPLATE_ID)) p.push('MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required for OTP login');
  if (c.GSP_MODE === 'mock') p.push('GSP_MODE=mock: mock IRNs are not valid tax invoices');
  if (/127\.0\.0\.1|localhost/.test(c.MONGODB_URI)) p.push('MONGODB_URI points to localhost: use MongoDB Atlas (Mumbai) or a managed replica set');
  if (!c.APP_URL.startsWith('https://')) p.push('APP_URL must be the public https:// address of the app');
  if (c.CORS_ORIGINS.split(',').some(o => /localhost|127\.0\.0\.1/.test(o))) p.push('CORS_ORIGINS still allows localhost');
  if (c.JWT_ACCESS_SECRET === c.JWT_REFRESH_SECRET) p.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  return p;
}

if (config.NODE_ENV === 'production') {
  const problems = productionProblems(config);
  if (problems.length) {
    console.error('❌ Not safe to run in production:\n' + problems.map(x => '  - ' + x).join('\n'));
    process.exit(1);
  }
}

export const isProd = config.NODE_ENV === 'production';
