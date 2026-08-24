const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Cart = require('../src/models/Cart');
const Order = require('../src/models/Order');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, createAdmin, accessCookie } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

let categorySeq = 0;
async function createCategory() {
  categorySeq += 1;
  return Category.create({ name: `Category ${categorySeq}-${Date.now()}` });
}

async function createProduct(overrides = {}) {
  const category = overrides.category || (await createCategory());
  return Product.create({
    name: overrides.name || 'Test Product',
    description: 'A product used in tests',
    price: overrides.price ?? 100,
    category: category._id,
  });
}

describe('POST /api/orders (checkout)', () => {
  test('authenticated user with items in cart can check out', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 250 });
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 2 }],
      total: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('pending');
    expect(res.body.order.total).toBe(500);
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0]).toMatchObject({
      name: product.name,
      price: 250,
      quantity: 2,
    });

    const orderInDb = await Order.findById(res.body.order._id);
    expect(orderInDb).not.toBeNull();
  });

  test('unauthenticated user cannot check out', async () => {
    const res = await request(app).post('/api/orders');
    expect(res.status).toBe(401);
  });

  test('checkout with no cart on record is rejected', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(400);
  });

  test('empty cart cannot check out', async () => {
    const { user, accessToken } = await createUser();
    await Cart.create({ user: user._id, items: [], total: 0 });

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(400);
  });

  test('a product removed from the catalog after being added to the cart is handled correctly, and the cart is left untouched', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct();
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1 }],
      total: 0,
    });
    await Product.deleteOne({ _id: product._id });

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(404);

    const cart = await Cart.findOne({ user: user._id });
    expect(cart.items).toHaveLength(1);
    expect(await Order.countDocuments({ user: user._id })).toBe(0);
  });

  test('an unavailable product blocks checkout and leaves the cart untouched', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct();
    product.isActive = false;
    await product.save();
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1 }],
      total: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(400);

    const cart = await Cart.findOne({ user: user._id });
    expect(cart.items).toHaveLength(1);
  });

  test('server recalculates the total from live product prices and ignores any client-supplied total/price', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 75 });
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 3 }],
      total: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken))
      .send({ total: 1, items: [{ price: 1, quantity: 1 }] });

    expect(res.status).toBe(201);
    expect(res.body.order.total).toBe(225);
    expect(res.body.order.items[0].price).toBe(75);
  });

  test('cart is cleared after a successful checkout', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 40 });
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1 }],
      total: 0,
    });

    await request(app).post('/api/orders').set('Cookie', accessCookie(accessToken));

    const cart = await Cart.findOne({ user: user._id });
    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
  });
});

describe('GET /api/orders and /api/orders/:id', () => {
  test('user can retrieve their own orders', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 50 });
    await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app).get('/api/orders').set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
  });

  test('user can retrieve a specific order', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 50 });
    const order = await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.order._id).toBe(String(order._id));
  });

  test("user cannot retrieve another user's order", async () => {
    const { user: userA } = await createUser();
    const { accessToken: tokenB } = await createUser();
    const product = await createProduct({ price: 50 });
    const order = await Order.create({
      user: userA._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Cookie', accessCookie(tokenB));
    expect(res.status).toBe(404);
  });

  test('an invalid order ID is rejected', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .get('/api/orders/not-a-valid-id')
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(400);
  });

  test('a normal user cannot update order status', async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 50 });
    const order = await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', accessCookie(accessToken))
      .send({ status: 'confirmed' });
    expect(res.status).toBe(403);

    const unchanged = await Order.findById(order._id);
    expect(unchanged.status).toBe('pending');
  });
});

describe('Admin order management', () => {
  test('admin can view all orders', async () => {
    const { user } = await createUser();
    const { accessToken: adminToken } = await createAdmin();
    const product = await createProduct({ price: 50 });
    await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app)
      .get('/api/orders/all')
      .set('Cookie', accessCookie(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
  });

  test('admin can update order status', async () => {
    const { user } = await createUser();
    const { accessToken: adminToken } = await createAdmin();
    const product = await createProduct({ price: 50 });
    const order = await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('confirmed');
  });

  test('an invalid status value is rejected', async () => {
    const { accessToken: adminToken } = await createAdmin();
    const { user } = await createUser();
    const product = await createProduct({ price: 50 });
    const order = await Order.create({
      user: user._id,
      items: [{ product: product._id, name: product.name, price: 50, quantity: 1 }],
      total: 50,
    });

    const res = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Cookie', accessCookie(adminToken))
      .send({ status: 'shipped' });
    expect(res.status).toBe(400);
  });

  test('a normal user cannot access admin order endpoints', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .get('/api/orders/all')
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(403);
  });
});

describe('Data integrity: price snapshot', () => {
  test("changing a product's price after checkout does not change the existing order's price", async () => {
    const { user, accessToken } = await createUser();
    const product = await createProduct({ price: 500 });
    await Cart.create({
      user: user._id,
      items: [{ product: product._id, quantity: 1 }],
      total: 0,
    });

    const checkoutRes = await request(app)
      .post('/api/orders')
      .set('Cookie', accessCookie(accessToken));
    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.order.items[0].price).toBe(500);

    product.price = 600;
    await product.save();

    const orderRes = await request(app)
      .get(`/api/orders/${checkoutRes.body.order._id}`)
      .set('Cookie', accessCookie(accessToken));
    expect(orderRes.body.order.items[0].price).toBe(500);
    expect(orderRes.body.order.total).toBe(500);

    const freshProduct = await Product.findById(product._id);
    expect(freshProduct.price).toBe(600);
  });
});
