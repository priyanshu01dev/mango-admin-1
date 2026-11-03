import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
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
import { publicRouter } from './routes/public';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind a load balancer: real client IP for rate limits and audit
  app.use(helmet());
  const origins = config.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), allowedHeaders: ['Authorization', 'Content-Type', 'X-Business-Id', 'X-Platform'] }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    const db = mongoose.connection.readyState === 1;
    res.status(db ? 200 : 503).json({ ok: db, db: db ? 'connected' : 'down', env: config.NODE_ENV, gsp: config.GSP_MODE, sms: config.SMS_PROVIDER });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter); // no login: customer-facing invoice links
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
  scoped.use('/reports', reportsRouter);
  app.use('/api', scoped);

  app.use('/api', (_req, _res, next) => next(notFound('Endpoint')));
  app.use(errorHandler);
  return app;
}
