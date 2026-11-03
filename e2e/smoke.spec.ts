import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@mangoinvoice.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'LocalDevOnly#2026';

/** Fails the test on uncaught errors and CSP violations (the things that break silently in production). */
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 4\d\d/.test(t)) problems.push(`console: ${t}`);
    if (/Content Security Policy/i.test(t)) problems.push(`csp: ${t}`);
  });
  return problems;
}

async function apiLogin(request: APIRequestContext, phone: string) {
  const r1 = await (await request.post('/api/auth/otp/request', { data: { phone } })).json();
  const r2 = await (await request.post('/api/auth/otp/verify', { data: { phone, code: r1.devCode, name: 'E2E' } })).json();
  return r2 as { accessToken: string; businesses: { business: { _id: string } }[] };
}

test('legal pages are public', async ({ page }) => {
  for (const [path, heading] of [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/refund-policy', 'Cancellation & Refund Policy'], ['/contact', 'Contact & Grievances'], ['/delete-account', 'Delete your account']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
});

test('super admin: login and every screen renders without errors', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await page.locator('input[type=email]').fill(ADMIN_EMAIL);
  await page.locator('input[type=password]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('aside')).toBeVisible();
  await expect(page.getByText('Platform Admin')).toBeVisible();

  const items = page.locator('aside nav button');
  const n = await items.count();
  expect(n).toBeGreaterThan(15);
  for (let i = 0; i < n; i++) {
    const label = (await items.nth(i).innerText()).split('\n')[0];
    await items.nth(i).click();
    await page.waitForTimeout(700);
    await expect(page.getByText('Something went wrong on this screen'), `screen "${label}" crashed`).toHaveCount(0);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('merchant: OTP signup, onboarding, invoice print with UPI QR', async ({ page, request }) => {
  const problems = watch(page);
  const phone = `98${String(Date.now()).slice(-8)}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Mobile OTP' }).click();
  await page.getByPlaceholder('98100 12345').fill(phone);
  await page.getByRole('button', { name: /Send OTP/ }).click();
  const code = (await page.locator('b.font-mono').innerText()).trim();
  await page.getByPlaceholder('••••••').fill(code);
  await page.getByPlaceholder('Your name (first login only)').fill('E2E Merchant');
  await page.getByRole('button', { name: /Verify/ }).click();

  await expect(page.getByText('Set up your business')).toBeVisible();
  await page.getByLabel('Business legal name').fill('E2E Kirana Store');
  await page.getByRole('button', { name: 'Create business' }).click();
  await expect(page.getByText('Quick actions')).toBeVisible({ timeout: 15_000 });

  // data through the API (same server), then check it in the UI
  const s = await apiLogin(request, phone);
  const h = { Authorization: `Bearer ${s.accessToken}`, 'X-Business-Id': s.businesses[0].business._id };
  await request.patch('/api/businesses/current', { headers: h, data: { upiId: 'e2ekirana@okhdfc', address: 'Shop 4, Main Bazaar', pincode: '110006' } });
  const party = await (await request.post('/api/parties', { headers: h, data: { type: 'CUSTOMER', name: 'Ramesh Traders', stateCode: '07', phone: '9811100000' } })).json();
  const item = await (await request.post('/api/products', { headers: h, data: { name: 'Sugar 1kg', hsnCode: '1701', taxRate: 5, sellingPrice: 48, purchasePrice: 42, openingStock: 100, barcode: '8900000000017' } })).json();
  const inv = await (await request.post('/api/invoices', { headers: h, data: { partyId: party._id, items: [{ productId: item._id, quantity: 10 }] } })).json();
  expect(inv.number).toMatch(/^INV\//);

  await page.reload();
  await page.locator('aside nav button', { hasText: 'Invoices' }).first().click();
  await expect(page.getByText(inv.number).first()).toBeVisible();

  // print preview → print window built from the opener (CSP blocks inline scripts)
  await page.getByTitle(/print/i).first().click();
  const qr = page.locator('img[alt="UPI QR code"]');
  await expect(qr).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Print \/ Save as PDF/ }).click();
  const popup = await popupPromise;
  await expect(popup.getByText(inv.number).first()).toBeVisible();
  await expect(popup.locator('img[alt="UPI QR"]')).toBeVisible();

  expect(problems, problems.join('\n')).toEqual([]);
});

test('POS: scan a barcode, bill and print a thermal receipt', async ({ page, request }) => {
  test.setTimeout(120_000);
  const problems = watch(page);
  const phone = `97${String(Date.now()).slice(-8)}`;
  const s = await apiLogin(request, phone);
  const b = await (await request.post('/api/businesses', { headers: { Authorization: `Bearer ${s.accessToken}` }, data: { name: 'E2E POS Shop', stateCode: '07' } })).json();
  const h = { Authorization: `Bearer ${s.accessToken}`, 'X-Business-Id': b._id };
  await request.post('/api/products', { headers: h, data: { name: 'Biscuit pack', hsnCode: '1905', taxRate: 18, sellingPrice: 30, openingStock: 50, barcode: '8901111111116' } });

  // browser login for the same user
  await page.goto('/');
  await page.getByRole('button', { name: 'Mobile OTP' }).click();
  await page.getByPlaceholder('98100 12345').fill(phone);
  await page.waitForTimeout(31_000); // the server allows one OTP per 30 s per number; the API login above used it
  await page.getByRole('button', { name: /Send OTP/ }).click();
  const otp = (await page.locator('b.font-mono').innerText()).trim();
  await page.getByPlaceholder('••••••').fill(otp);
  await page.getByRole('button', { name: /Verify/ }).click();

  await page.locator('aside nav button', { hasText: 'POS Counter' }).click();
  const scan = page.getByPlaceholder('Scan barcode or type item name / SKU');
  await scan.fill('8901111111116');
  await scan.press('Enter');
  await scan.fill('8901111111116');
  await scan.press('Enter');
  await expect(page.getByText('Biscuit pack')).toBeVisible();
  await expect(page.getByText('₹71.00').first()).toBeVisible(); // 2 × 30 + 18% = 70.80 → 71
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: /& print/ }).click();
  const popup = await popupPromise;
  await expect(popup.getByText('TAX INVOICE')).toBeVisible();
  expect(problems, problems.join('\n')).toEqual([]);
});
