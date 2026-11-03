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
  TRIAL_DAYS: z.coerce.number().default(7),
  TRIAL_PLAN: z.enum(['silver', 'gold', 'platinum']).default('gold')
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid server environment:\n' + parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const config = parsed.data;

if (config.NODE_ENV === 'production') {
  if (config.SMS_PROVIDER === 'console') throw new Error('SMS_PROVIDER=console is not allowed in production');
  if (config.GSP_MODE === 'mock') throw new Error('GSP_MODE=mock is not allowed in production: mock IRNs are not valid tax invoices');
}

export const isProd = config.NODE_ENV === 'production';
