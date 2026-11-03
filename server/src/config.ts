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
