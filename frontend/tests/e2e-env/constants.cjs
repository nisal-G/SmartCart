/**
 * Shared identifiers for the E2E harness. Every record the harness creates
 * is prefixed "TEST QA" so it's unmistakably test data (see project QA
 * rules) even though — per the harness design — none of it ever touches a
 * real database: the whole stack in tests/e2e-env/global-setup.cjs runs
 * against a throwaway in-memory MongoDB, not the real Atlas cluster in
 * backend/.env.
 */
const BACKEND_PORT = 5051;
const BACKEND_BASE_URL = `http://localhost:${BACKEND_PORT}`;
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api`;
const FRONTEND_PORT = 5173;
const FRONTEND_BASE_URL = `http://localhost:${FRONTEND_PORT}`;

const ADMIN_EMAIL = 'test-qa-admin@smartcart.test';
const ADMIN_PASSWORD = 'TestQA-Admin-Pass1!';
const ADMIN_NAME = 'TEST QA Admin';

const CUSTOMER_EMAIL = 'test-qa-customer@smartcart.test';
const CUSTOMER_NAME = 'TEST QA Customer';

// A second, otherwise-untouched customer — used only where a test needs a
// guaranteed-pristine account (e.g. the order-history empty state), since
// the primary TEST QA Customer above accumulates real orders/cart activity
// from the rest of the suite over a single run.
const CUSTOMER2_EMAIL = 'test-qa-customer-2@smartcart.test';
const CUSTOMER2_NAME = 'TEST QA Customer Two';

// Fake-but-well-formed PayHere config for the ephemeral backend only, so
// createPayhereSession's isConfigured check passes and its (purely local,
// no-network) hash computation can be exercised at the API level. Never the
// real merchant secret — that stays blank in backend/.env and is never read
// by this harness.
const PAYHERE_TEST_CONFIG = {
  PAYHERE_MERCHANT_ID: 'test-merchant-id',
  PAYHERE_MERCHANT_SECRET: 'test-merchant-secret-not-real',
  PAYHERE_SANDBOX: 'true',
  PAYHERE_CURRENCY: 'LKR',
  PAYHERE_RETURN_URL: `${FRONTEND_BASE_URL}/payment/return`,
  PAYHERE_CANCEL_URL: `${FRONTEND_BASE_URL}/payment/cancel`,
  // Deliberately unreachable — no test ever triggers a real PayHere
  // notification, so nothing ever calls this URL.
  PAYHERE_NOTIFY_URL: `${BACKEND_API_URL}/payments/payhere/notify`,
};

const RUNTIME_DIR = `${__dirname}/.runtime`;
const SEED_INFO_PATH = `${RUNTIME_DIR}/seed-info.json`;
const ADMIN_STORAGE_STATE_PATH = `${RUNTIME_DIR}/admin-storage-state.json`;
const CUSTOMER_STORAGE_STATE_PATH = `${RUNTIME_DIR}/customer-storage-state.json`;
const CUSTOMER2_STORAGE_STATE_PATH = `${RUNTIME_DIR}/customer2-storage-state.json`;

module.exports = {
  BACKEND_PORT,
  BACKEND_BASE_URL,
  BACKEND_API_URL,
  FRONTEND_PORT,
  FRONTEND_BASE_URL,
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
  ADMIN_STORAGE_STATE_PATH,
  CUSTOMER_STORAGE_STATE_PATH,
  CUSTOMER2_STORAGE_STATE_PATH,
};
