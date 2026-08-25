import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { customerTest } from '../fixtures.js';
import { BACKEND_API_URL } from '../e2e-env/constants.cjs';
import { stubPayhere, getPayhereCalls } from '../e2e-env/payhere-stub.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', '..', 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const SRC_FILES = walk(SRC_DIR).filter((f) => /\.(js|jsx)$/.test(f));
const SRC_TEXT = SRC_FILES.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') }));

test.describe('Security review — static source scan (frontend/src)', () => {
  test('no real secret env vars (Merchant Secret, Supabase secret key, JWT secret) are read or referenced', async () => {
    // These names should never appear at all — the frontend has no
    // business reading server-only config, and Vite only ever exposes
    // `import.meta.env.VITE_*`-prefixed vars to the client bundle, so
    // these structurally can't leak through the frontend's own env
    // handling unless someone explicitly re-declared one under a VITE_
    // prefix (checked separately below).
    const forbiddenNames = [
      'PAYHERE_MERCHANT_SECRET',
      'SUPABASE_SECRET_KEY',
      'JWT_SECRET',
      'MONGODB_URI',
    ];
    const offenders = [];
    for (const { file, text } of SRC_TEXT) {
      for (const name of forbiddenNames) {
        if (text.includes(name)) offenders.push(`${name} in ${path.relative(SRC_DIR, file)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no hardcoded secret-shaped values (API keys, passwords) in source', async () => {
    const patterns = [
      { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
      { name: 'Stripe-style secret key', re: /sk_(live|test)_[A-Za-z0-9]{10,}/ },
      { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9]+/ },
      { name: 'generic hardcoded password literal', re: /password\s*[:=]\s*['"][^'"]{6,}['"]/i },
    ];
    const offenders = [];
    for (const { file, text } of SRC_TEXT) {
      for (const { name, re } of patterns) {
        if (re.test(text)) offenders.push(`${name} in ${path.relative(SRC_DIR, file)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('paymentService.js never calls the notify endpoint and never computes a hash itself', async () => {
    const file = SRC_TEXT.find((f) => f.file.endsWith('paymentService.js'));
    expect(file).toBeTruthy();
    // Strip comments so this checks actual code, not the explanatory
    // comments already IN this file about why notify/hash are absent.
    const code = file.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/payhere\/notify/);
    expect(code).not.toMatch(/md5|createHash/i);
    expect(code).toMatch(/payhere\/session/);
  });

  test('no frontend source file calls the payhere/notify endpoint from actual code', async () => {
    // Several files legitimately DISCUSS notify_url in comments (why the
    // frontend must never call it, why a late notification can race a
    // redirect) — see paymentService.js, PaymentCancel.jsx,
    // usePaymentStatus.js. Strip comments first so this checks real calls,
    // not documentation of their absence.
    const offenders = [];
    for (const { file, text } of SRC_TEXT) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (/payhere\/notify/.test(code)) offenders.push(path.relative(SRC_DIR, file));
    }
    expect(offenders).toEqual([]);
  });

  test('no localStorage/sessionStorage write stores anything token/credential-shaped', async () => {
    // sessionStorage IS used, but only for a non-sensitive order id (see
    // utils/paymentSession.js) — confirm nothing else is ever stored under
    // a token/password/secret-shaped key anywhere in the source.
    const storageWriteRe = /(localStorage|sessionStorage)\.setItem\(\s*['"]([^'"]+)['"]/g;
    const offenders = [];
    for (const { file, text } of SRC_TEXT) {
      let m;
      while ((m = storageWriteRe.exec(text))) {
        const key = m[2];
        if (/token|password|secret|credential|auth/i.test(key)) {
          offenders.push(`${m[1]}.setItem("${key}") in ${path.relative(SRC_DIR, file)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

customerTest.describe('Security review — runtime', () => {
  customerTest('no accessToken/refreshToken readable via document.cookie or present in localStorage after a real login-derived session', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('TEST QA Customer')).toBeVisible();

    const jsVisibleCookies = await page.evaluate(() => document.cookie);
    expect(jsVisibleCookies).not.toMatch(/accessToken|refreshToken/);

    const localStorageDump = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
    expect(localStorageDump).not.toMatch(/accessToken|refreshToken/);
  });

  customerTest('a full checkout flow never issues a request to /payments/payhere/notify and the session response never carries the Merchant Secret', async ({
    page,
    context,
  }) => {
    await context.request.delete(`${BACKEND_API_URL}/cart`);
    const products = await context.request.get(`${BACKEND_API_URL}/products?search=TEST QA Tomato`).then((r) => r.json());
    await context.request.post(`${BACKEND_API_URL}/cart/items`, {
      data: { productId: products.products[0]._id, quantity: 1 },
    });
    await stubPayhere(page);

    const notifyRequests = [];
    page.on('request', (req) => {
      if (req.url().includes('/payments/payhere/notify')) notifyRequests.push(req.url());
    });

    await page.goto('/checkout');
    await page.getByLabel('Phone').fill('0771234567');
    await page.getByLabel('City').fill('Colombo');
    await page.getByLabel('Address').fill('123 Test Lane');
    await page.getByLabel('Country').fill('Sri Lanka');

    const sessionResponsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/payments/payhere/session') && res.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Proceed to payment' }).click();
    const sessionResponse = await sessionResponsePromise;
    const sessionBody = await sessionResponse.json();

    expect(notifyRequests).toEqual([]);
    expect(JSON.stringify(sessionBody)).not.toMatch(/merchant_secret|test-merchant-secret-not-real/i);
    expect(await getPayhereCalls(page)).toHaveLength(1);
  });

  customerTest('an API error surfaces a sanitized message, never a stack trace or MongoDB/Axios internals', async ({
    page,
  }) => {
    await page.goto('/orders/not-a-valid-object-id');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/CastError|ValidatorError|at\s+\w+\s*\(.*\.js:\d+/);
    expect(bodyText).not.toMatch(/node_modules|ECONNREFUSED|MongooseError/i);
  });
});
