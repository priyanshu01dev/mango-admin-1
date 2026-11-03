import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config';
import { errorHandler, notFound } from './lib/errors';
import { requireAuth, requireBusiness } from './middleware/auth';
import { authRouter } from './routes/auth';
import { businessRouter } from './routes/businesses';
import { mastersRouter } from './routes/masters';
import { txRouter } from './routes/transactions';
import { reportsRouter } from './routes/reports';
import { supportRouter } from './routes/support';
import { adminRouter } from './routes/admin';
import { phase2Router } from './routes/phase2';
import { inventoryRouter } from './routes/inventory';
import { integrationsRouter, webhookRouter } from './routes/integrations';
import { publicRouter } from './routes/public';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind a load balancer: real client IP for rate limits and audit

  // request id + one-line access log (JSON in production so log tools can parse it)
  app.use((req, res, next) => {
    const id = String(req.headers['x-request-id'] ?? crypto.randomUUID());
    res.setHeader('X-Request-Id', id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      if (config.NODE_ENV === 'test' || req.path === '/api/health') return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const entry = { t: new Date().toISOString(), id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms), ip: req.ip };
      if (config.NODE_ENV === 'production') console.log(JSON.stringify(entry));
      else if (req.path.startsWith('/api')) console.log(`${entry.method} ${entry.path} ${entry.status} ${entry.ms}ms`);
    });
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
          frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );
  const origins = config.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), allowedHeaders: ['Authorization', 'Content-Type', 'X-Business-Id', 'X-Platform'] }));
  // keep the raw body: webhook signatures are computed over the exact bytes received
  app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => ((req as express.Request & { rawBody?: Buffer }).rawBody = buf) }));

  app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ ok: db, db: db ? 'connected' : 'down', env: config.NODE_ENV, gsp: config.GSP_MODE, sms: config.SMS_PROVIDER });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter); // no login: customer-facing invoice links
  app.use('/api/webhooks', webhookRouter); // no login: verified by signature
  app.use('/api/businesses', requireAuth, businessRouter);
  app.use('/api/admin', requireAuth, adminRouter);
  // business-scoped API: needs a login and an X-Business-Id the user is a member of (checked once)
  const scoped = express.Router();
  scoped.use(requireAuth, requireBusiness);
  scoped.use(supportRouter);
  scoped.use(mastersRouter);
  scoped.use(txRouter);
  scoped.use(phase2Router);
  scoped.use(inventoryRouter);
  scoped.use(integrationsRouter);
  scoped.use('/reports', reportsRouter);
  app.use('/api', scoped);

  app.use('/api', (_req, _res, next) => next(notFound('Endpoint')));

  // production: the same server delivers the built web app (one origin, no CORS needed)
  const staticDir = config.STATIC_DIR ? path.resolve(config.STATIC_DIR) : '';
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, file) => file.endsWith('.html') && res.setHeader('Cache-Control', 'no-cache') }));
    // client-side routes (/i/<token>, /privacy, …) get index.html
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }
  app.use(errorHandler);
  return app;
}
