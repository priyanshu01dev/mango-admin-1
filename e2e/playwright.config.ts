import { defineConfig } from '@playwright/test';

/**
 * Browser smoke tests against a production build (API + web from one server, real CSP).
 *   npm run build && npm run server:build
 *   PORT=4100 STATIC_DIR=dist node dist-server/index.js     (needs a dev database: npm run db:dev)
 *   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run e2e
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4100',
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
