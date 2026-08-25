const path = require('path');
const fs = require('fs');
const {
  BACKEND_PORT,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
  CUSTOMER_EMAIL,
  CUSTOMER_NAME,
  CUSTOMER2_EMAIL,
  CUSTOMER2_NAME,
  PAYHERE_TEST_CONFIG,
  RUNTIME_DIR,
  SEED_INFO_PATH,
  CUSTOMER_STORAGE_STATE_PATH,
  CUSTOMER2_STORAGE_STATE_PATH,
  FRONTEND_BASE_URL,
} = require('./constants.cjs');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..', '..', 'backend');
const backendPath = (...segments) => path.join(BACKEND_ROOT, ...segments);

/**
 * Playwright global setup for the whole E2E run. Boots a completely
 * self-contained copy of the real backend — same `backend/src/app.js`,
 * same models/controllers, zero code changes — against a throwaway
 * in-memory MongoDB replica set (mirrors backend/tests/utils/db.js, which
 * this project's own Jest suite already uses for exactly this reason:
 * orderController.checkout runs a real multi-document transaction, which
 * needs a replica set, not a standalone mongod).
 *
 * This NEVER touches backend/.env's real MONGODB_URI (a shared Atlas
 * cluster) — see the QA plan for why that was a hard requirement, not a
 * convenience. Every env var the backend reads is set explicitly below,
 * before any backend module is required, since several of them
 * (tokenService's JWT_SECRET check, cors.js's FRONTEND_URL allow-list) are
 * read at module-load time.
 */
module.exports = async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = String(BACKEND_PORT);
  process.env.JWT_SECRET = 'e2e-harness-only-secret-never-used-outside-this-test-run';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_DAYS = '7';
  process.env.COOKIE_DOMAIN = '';
  process.env.FRONTEND_URL = FRONTEND_BASE_URL;
  process.env.LOG_LEVEL = process.env.E2E_BACKEND_LOG_LEVEL || 'silent';
  // Real OAuth cannot be automated (needs a live Google/Facebook consent
  // screen) and must never be faked — leaving these unset makes the
  // backend itself report "not configured" (503), the same honest state
  // as if we'd never touched them. See the final report's OAuth section.
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.FACEBOOK_APP_ID;
  delete process.env.FACEBOOK_APP_SECRET;
  // Supabase deliberately left unconfigured (confirmed decision: image
  // upload hardening verifies the outgoing browser request only, never a
  // real Supabase write). Upload endpoints will 503 if a test tries the
  // real round trip by mistake, which is the intended fail-safe.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_STORAGE_BUCKET;
  // Fake-but-well-formed PayHere config, ephemeral-backend-only, so
  // createPayhereSession's `isConfigured` check passes and its hash
  // computation (pure local MD5, no network call) is exercised at the API
  // level. The real merchant secret in backend/.env is never read here.
  Object.assign(process.env, PAYHERE_TEST_CONFIG);

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });

  // --- Ephemeral MongoDB ---------------------------------------------------
  const { MongoMemoryReplSet } = require(backendPath('node_modules', 'mongodb-memory-server'));
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replSet.getUri('smartcart-e2e');

  const connectDB = require(backendPath('src', 'config', 'db.js'));
  await connectDB();

  // --- Real backend app, unmodified, on a fixed local port ----------------
  const app = require(backendPath('src', 'app.js'));
  const server = app.listen(BACKEND_PORT);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  // --- Seed TEST QA accounts ------------------------------------------------
  const User = require(backendPath('src', 'models', 'User.js'));
  const tokenService = require(backendPath('src', 'services', 'tokenService.js'));

  // Admin: real password, logged in through the real /login UI form by
  // tests/auth.setup.js (a genuine password-based flow needs no shortcut).
  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
    status: 'active',
  });

  // Customer: SmartCart's only customer login is Google/Facebook OAuth,
  // which cannot be automated here and must never be faked at the frontend
  // (no forged /auth/callback hit). Instead this mints a REAL session via
  // the backend's own tokenService — the exact function
  // authController.issueSession() calls after a genuine OAuth exchange —
  // for a real user created directly in this throwaway database. This is
  // the same technique backend/tests/auth.oauth.test.js already uses for
  // the project's own Jest suite (stub the identity, call the real
  // session-issuing code) — never a mock of frontend auth state, never a
  // provider callback pretending to have succeeded.
  const cookieBase = { domain: 'localhost', httpOnly: true, sameSite: 'Lax', secure: false };

  /** Mints real cookies for `user` via the exact code path issueSession() uses, and writes a Playwright storageState file for it. */
  async function mintCustomerStorageState(user, storageStatePath) {
    const accessToken = tokenService.signAccessToken(user);
    const refreshTokenRaw = await tokenService.issueRefreshToken(user, {
      userAgent: 'playwright-e2e-global-setup',
      ip: '127.0.0.1',
    });
    await user.save();
    const storageState = {
      cookies: [
        { ...cookieBase, name: 'accessToken', value: accessToken, path: '/', expires: -1 },
        { ...cookieBase, name: 'refreshToken', value: refreshTokenRaw, path: '/api/auth', expires: -1 },
      ],
      origins: [],
    };
    fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  }

  const customer = await User.create({
    name: CUSTOMER_NAME,
    email: CUSTOMER_EMAIL,
    role: 'user',
    status: 'active',
  });
  await mintCustomerStorageState(customer, CUSTOMER_STORAGE_STATE_PATH);

  // Kept deliberately pristine — no test should add to its cart or place an
  // order for it — so a test that needs a guaranteed-empty account (e.g.
  // the order-history empty state) doesn't depend on suite run order.
  const customer2 = await User.create({
    name: CUSTOMER2_NAME,
    email: CUSTOMER2_EMAIL,
    role: 'user',
    status: 'active',
  });
  await mintCustomerStorageState(customer2, CUSTOMER2_STORAGE_STATE_PATH);

  // --- Baseline catalog -----------------------------------------------------
  // A small, deterministic, all-"TEST QA"-prefixed catalog so browsing/cart/
  // checkout/admin-list/pagination tests have real backend data to work
  // with, without any test having to create its own products just to see a
  // non-empty list. One product ("TEST QA Unavailable Veg") is inactive on
  // purpose, to exercise the "Unavailable" badge / add-to-cart gating.
  const Category = require(backendPath('src', 'models', 'Category.js'));
  const Product = require(backendPath('src', 'models', 'Product.js'));

  const [vegetables, fruits, bakery] = await Category.create([
    { name: 'TEST QA Vegetables', description: 'Seeded by the Playwright E2E harness.' },
    { name: 'TEST QA Fruits', description: 'Seeded by the Playwright E2E harness.' },
    { name: 'TEST QA Bakery', description: 'Seeded by the Playwright E2E harness.' },
  ]);

  await Product.create([
    { name: 'TEST QA Tomato', price: 120, category: vegetables._id, description: 'Fresh tomatoes.' },
    { name: 'TEST QA Potato', price: 80, category: vegetables._id },
    { name: 'TEST QA Carrot', price: 60, category: vegetables._id },
    { name: 'TEST QA Onion', price: 90, category: vegetables._id },
    { name: 'TEST QA Cabbage', price: 150, category: vegetables._id },
    { name: 'TEST QA Unavailable Veg', price: 40, category: vegetables._id, isActive: false },
    { name: 'TEST QA Apple', price: 200, category: fruits._id },
    { name: 'TEST QA Banana', price: 50, category: fruits._id },
    { name: 'TEST QA Mango', price: 250, category: fruits._id },
    { name: 'TEST QA Orange', price: 100, category: fruits._id },
    { name: 'TEST QA Grapes', price: 300, category: fruits._id },
    { name: 'TEST QA Bread', price: 180, category: bakery._id },
    { name: 'TEST QA Cake', price: 900, category: bakery._id },
    { name: 'TEST QA Cookies', price: 220, category: bakery._id },
  ]);

  fs.writeFileSync(
    SEED_INFO_PATH,
    JSON.stringify(
      {
        mongodbUri: process.env.MONGODB_URI,
        backendPort: BACKEND_PORT,
        admin: { id: String(admin._id), email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
        customer: { id: String(customer._id), email: CUSTOMER_EMAIL, name: CUSTOMER_NAME },
        customer2: { id: String(customer2._id), email: CUSTOMER2_EMAIL, name: CUSTOMER2_NAME },
        catalog: {
          categories: {
            vegetables: { id: String(vegetables._id), name: vegetables.name },
            fruits: { id: String(fruits._id), name: fruits.name },
            bakery: { id: String(bakery._id), name: bakery.name },
          },
          // A handful of well-known, deterministically-priced products for
          // tests that need to target a specific product rather than "any".
          products: {
            tomato: { name: 'TEST QA Tomato', price: 120 },
            unavailableVeg: { name: 'TEST QA Unavailable Veg', price: 40 },
          },
          totalProducts: 14,
        },
      },
      null,
      2
    )
  );

  // Playwright treats a function returned from globalSetup as the
  // matching teardown — run once, after the whole suite finishes.
  return async function globalTeardown() {
    await new Promise((resolve) => server.close(resolve));
    const mongoose = require(backendPath('node_modules', 'mongoose'));
    await mongoose.connection.close();
    await replSet.stop();
  };
};
