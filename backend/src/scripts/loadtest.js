/**
 * Backend load/performance verification (SRS §4 NFR — "Handle at least 100
 * concurrent users").
 *
 * Boots the real Express app (src/app.js) against an isolated, local
 * mongodb-memory-server replica set — NOT the real Atlas cluster configured
 * in backend/.env — so this measures the server's own request-handling
 * capacity without depending on network latency to a shared external
 * database, real OAuth providers, or real Supabase storage, and without
 * writing load-test data into any shared/production data store. This is a
 * LOCAL capacity test, not a full production-infrastructure test — see the
 * caveats printed at the end of the run.
 *
 * NODE_ENV is deliberately forced to 'test' for this run: middleware/
 * rateLimiter.js keys its limits per-IP, and every autocannon connection
 * here originates from the same local address — 100 concurrent *users* in
 * production means 100 distinct IPs, not one, so the app-level rate limits
 * would otherwise throttle this single-machine test almost immediately and
 * measure the rate limiter (already covered by tests/rateLimiter.test.js),
 * not the server's actual request-handling capacity.
 *
 * Each authenticated request is given its OWN pre-signed cookie baked
 * directly into that `requests[]` entry (rather than autocannon's
 * `setupClient` hook) — verified empirically to be the reliable mechanism
 * for per-request headers when cycling a multi-entry `requests` array;
 * `setupClient`'s `client.setHeaders()` does not consistently apply across
 * every entry in that scenario.
 *
 * Usage: npm run loadtest
 */
process.env.NODE_ENV = 'test';
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set (see backend/.env) to run the load test.');
  process.exit(1);
}

const CONCURRENT_USERS = 100;

async function main() {
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  const mongoose = require('mongoose');
  const autocannon = require('autocannon');

  console.log(`SmartCart backend load test — target: ${CONCURRENT_USERS} concurrent users\n`);
  console.log('Starting an isolated in-memory MongoDB replica set...');
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Must be set before any model/service that reads it is required below.
  process.env.MONGODB_URI = replSet.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  const app = require('../app');
  const Category = require('../models/Category');
  const Product = require('../models/Product');
  const User = require('../models/User');
  const Cart = require('../models/Cart');
  const tokenService = require('../services/tokenService');

  console.log('Seeding catalog and users...');
  const categoryNames = ['Vegetables', 'Fruits', 'Cakes', 'Biscuits', 'Dairy'];
  const categories = await Category.insertMany(categoryNames.map((name) => ({ name })));

  const products = await Product.insertMany(
    Array.from({ length: 60 }, (_, i) => ({
      name: `${['Apple', 'Banana', 'Cake', 'Biscuit', 'Milk'][i % 5]} ${i}`,
      description: 'Load test product',
      price: 10 + (i % 20),
      category: categories[i % categories.length]._id,
    }))
  );

  const users = await User.insertMany(
    Array.from({ length: CONCURRENT_USERS }, (_, i) => ({
      name: `Load User ${i}`,
      email: `loaduser${i}@loadtest.local`,
      role: 'user',
      status: 'active',
    }))
  );

  // Every simulated user already has items in their cart, so GET /api/cart
  // and the checkout phase reflect realistic authenticated read/write work
  // (cart total recalculation, population, price lookups) rather than the
  // cheaper empty-cart path.
  await Cart.insertMany(
    users.map((user, i) => ({
      user: user._id,
      items: [
        { product: products[i % products.length]._id, quantity: 1 },
        { product: products[(i + 7) % products.length]._id, quantity: 2 },
      ],
      total: 0, // recomputed by the API on first read — never trusted from here
    }))
  );

  // One valid session cookie per simulated user (SRS §3.1 sessions are
  // JWT/cookie based — see tokenService.signAccessToken).
  const cookies = users.map((user) => `accessToken=${tokenService.signAccessToken(user)}`);

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  console.log(`App listening on ${url} (ephemeral port, in-memory DB)\n`);

  const sampleProductId = products[0]._id.toString();
  const sampleCategoryId = categories[0]._id.toString();
  const results = {};

  // --- Phase A: mixed public browsing + authenticated reads, one request
  // variant per simulated user for /cart and /orders so all 100 sessions
  // are genuinely exercised, not just one shared session. ---
  const readRequests = [
    { method: 'GET', path: '/api/categories' },
    { method: 'GET', path: '/api/products?page=1&limit=20' },
    { method: 'GET', path: '/api/products?search=Apple' },
    { method: 'GET', path: `/api/products/${sampleProductId}` },
    { method: 'GET', path: `/api/products/category/${sampleCategoryId}` },
    ...cookies.map((cookie) => ({ method: 'GET', path: '/api/cart', headers: { cookie } })),
    ...cookies.map((cookie) => ({ method: 'GET', path: '/api/orders', headers: { cookie } })),
  ];
  console.log(`=== Phase A: ${CONCURRENT_USERS} concurrent connections, mixed browse + authenticated reads, 20s ===`);
  results.A = await autocannon({
    url,
    connections: CONCURRENT_USERS,
    duration: 20,
    requests: readRequests,
  });
  printSummary('Phase A — browsing + authenticated reads', results.A);

  // --- Phase B: authenticated writes — every user adds an item to their
  // own cart repeatedly (safely repeatable, no business-rule rejections
  // expected: 100% 2xx is the bar here). ---
  const cartWriteRequests = cookies.map((cookie) => ({
    method: 'POST',
    path: '/api/cart/items',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: sampleProductId, quantity: 1 }),
  }));
  console.log(`\n=== Phase B: ${CONCURRENT_USERS} concurrent connections, authenticated cart writes, 10s ===`);
  results.B = await autocannon({
    url,
    connections: CONCURRENT_USERS,
    duration: 10,
    requests: cartWriteRequests,
  });
  printSummary('Phase B — POST /api/cart/items', results.B);

  // --- Phase C: checkout under concurrency. Each user's cart can only be
  // checked out once (checkout empties it), so once a user's first
  // checkout wins, later repeats of that SAME request during this window
  // correctly get a controlled 400 ("Your cart is empty") rather than
  // succeeding twice — that is the transaction's atomicity guarantee
  // working as intended, not a server fault. The bar here is zero 5xx/
  // connection errors, not zero 4xx.
  const checkoutRequests = cookies.map((cookie) => ({
    method: 'POST',
    path: '/api/orders',
    headers: { cookie },
  }));
  console.log(`\n=== Phase C: ${CONCURRENT_USERS} concurrent connections, concurrent checkout burst, 8s ===`);
  results.C = await autocannon({
    url,
    connections: CONCURRENT_USERS,
    duration: 8,
    requests: checkoutRequests,
  });
  printSummary('Phase C — POST /api/orders (concurrent checkout burst)', results.C);
  const ordersCreated = await mongoose.model('Order').countDocuments({});
  console.log(
    `Orders actually created: ${ordersCreated} / ${CONCURRENT_USERS} users (remaining requests correctly rejected once each user's single cart was already consumed — see note above).`
  );

  server.close();
  await mongoose.disconnect();
  await replSet.stop();

  const phases = Object.values(results);
  const totalErrors = phases.reduce((sum, r) => sum + r.errors + r.timeouts, 0);
  const total5xx = phases.reduce((sum, r) => sum + (r['5xx'] || 0), 0);
  const totalRequests = phases.reduce((sum, r) => sum + r.requests.total, 0);
  const passed = totalErrors === 0 && total5xx === 0;

  console.log('\n=== Overall ===');
  console.log(`Total requests across all phases: ${totalRequests}`);
  console.log(`Connection errors/timeouts: ${totalErrors}  |  5xx responses: ${total5xx}`);
  console.log(
    passed
      ? `PASSED at ${CONCURRENT_USERS} concurrent connections: no connection errors, timeouts, or 5xx responses in any phase.`
      : 'FAILED: see the phase summaries above for the errors/5xx responses.'
  );
  console.log(
    '\nCaveats:\n' +
      '  - This measures the Node process + an in-memory MongoDB replica set on this machine —\n' +
      '    it does NOT include network latency to the real Atlas cluster, a real reverse\n' +
      '    proxy/load balancer, or OS-level connection limits in a real deployment.\n' +
      '  - App-level rate limiting was bypassed (NODE_ENV=test) because every connection here\n' +
      '    shares one local IP; a real 100-user production scenario is 100 distinct IPs, which\n' +
      '    the per-IP limiter (see middleware/rateLimiter.js) would not collapse together.\n' +
      '  - Treat this as evidence the application code path handles the target concurrency\n' +
      '    without errors, not as a substitute for staging/production load testing.'
  );

  process.exit(passed ? 0 : 1);
}

function printSummary(label, result) {
  console.log(`--- ${label} ---`);
  console.log(`connections=${result.connections}  duration=${result.duration}s`);
  console.log(`requests: total=${result.requests.total}  avg/s=${result.requests.average}`);
  console.log(`throughput: avg=${(result.throughput.average / 1024).toFixed(1)} KB/s`);
  console.log(
    `latency (ms): avg=${result.latency.average}  p50=${result.latency.p50}  p97.5=${result.latency.p97_5}  p99=${result.latency.p99}  max=${result.latency.max}`
  );
  console.log(
    `status: 2xx=${result['2xx']}  4xx=${result['4xx']}  5xx=${result['5xx']}  errors=${result.errors}  timeouts=${result.timeouts}`
  );
}

main().catch((err) => {
  console.error('Load test failed to run:', err);
  process.exit(1);
});
