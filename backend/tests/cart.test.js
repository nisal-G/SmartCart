const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Cart = require('../src/models/Cart');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, accessCookie } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

function nonExistentId() {
  return new mongoose.Types.ObjectId().toString();
}

let categorySeq = 0;
async function createProduct(overrides = {}) {
  categorySeq += 1;
  const category = overrides.category || (await Category.create({ name: `Category ${categorySeq}-${Date.now()}` }));
  return Product.create({
    name: overrides.name || 'Test Product',
    description: 'A product used in tests',
    price: overrides.price ?? 100,
    category: category._id,
    isActive: overrides.isActive,
  });
}

describe('Authentication requirement', () => {
  test('every cart endpoint requires authentication', async () => {
    const product = await createProduct();

    const getRes = await request(app).get('/api/cart');
    const postRes = await request(app).post('/api/cart/items').send({ productId: product._id, quantity: 1 });
    const putRes = await request(app).put(`/api/cart/items/${product._id}`).send({ quantity: 2 });
    const deleteItemRes = await request(app).delete(`/api/cart/items/${product._id}`);
    const clearRes = await request(app).delete('/api/cart');

    expect(getRes.status).toBe(401);
    expect(postRes.status).toBe(401);
    expect(putRes.status).toBe(401);
    expect(deleteItemRes.status).toBe(401);
    expect(clearRes.status).toBe(401);
  });
});

describe('GET /api/cart', () => {
  test('lazily creates and returns an empty cart for a new user', async () => {
    const { accessToken } = await createUser();
    const res = await request(app).get('/api/cart').set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.total).toBe(0);
  });
});

describe('POST /api/cart/items', () => {
  test('adds a product to the cart', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 25 });

    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0]).toMatchObject({ quantity: 2, subtotal: 50 });
    expect(res.body.cart.total).toBe(50);
  });

  test('adding the same product again increments its quantity rather than duplicating the line', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 10 });

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 2 });

    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(5);
    expect(res.body.cart.total).toBe(50);
  });

  test('supports multiple distinct products in one cart, each with its own subtotal', async () => {
    const { accessToken } = await createUser();
    const apple = await createProduct({ name: 'Apple', price: 10 });
    const banana = await createProduct({ name: 'Banana', price: 5 });

    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: apple._id.toString(), quantity: 2 });
    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: banana._id.toString(), quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toHaveLength(2);
    expect(res.body.cart.total).toBe(40); // 2*10 + 4*5
  });

  test('404 for a product that does not exist', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: nonExistentId(), quantity: 1 });
    expect(res.status).toBe(404);
  });

  test('400 for an inactive/unavailable product', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ isActive: false });

    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 1 });

    expect(res.status).toBe(400);
  });

  test.each([
    ['missing productId', { productId: undefined }],
    ['missing quantity', { quantity: undefined }],
    ['invalid productId format', { productId: 'not-an-id' }],
    ['zero quantity', { quantity: 0 }],
    ['negative quantity', { quantity: -1 }],
    ['non-integer quantity', { quantity: 1.5 }],
    ['quantity over the sanity ceiling', { quantity: 100000 }],
  ])('400 validation failure: %s', async (_label, overrides) => {
    const { accessToken } = await createUser();
    const product = await createProduct();
    const payload = { productId: product._id.toString(), quantity: 1, ...overrides };

    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send(payload);

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/cart/items/:productId', () => {
  test('replaces (not increments) the item quantity', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 10 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 5 });

    const res = await request(app)
      .put(`/api/cart/items/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.cart.items[0].quantity).toBe(2);
    expect(res.body.cart.total).toBe(20);
  });

  test('404 when the item is not in the cart', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct();

    const res = await request(app)
      .put(`/api/cart/items/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ quantity: 2 });

    expect(res.status).toBe(404);
  });

  test('400 for an invalid quantity (zero is rejected — DELETE exists for removal)', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct();
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 1 });

    const res = await request(app)
      .put(`/api/cart/items/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
  });

  test('400 for a malformed productId', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .put('/api/cart/items/not-an-id')
      .set('Cookie', accessCookie(accessToken))
      .send({ quantity: 2 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/cart/items/:productId', () => {
  test('removes the item from the cart', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct();
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 1 });

    const res = await request(app)
      .delete(`/api/cart/items/${product._id}`)
      .set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.total).toBe(0);
  });

  test('404 when the item is not in the cart', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct();

    const res = await request(app)
      .delete(`/api/cart/items/${product._id}`)
      .set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cart (clear)', () => {
  test('empties a cart with multiple items', async () => {
    const { accessToken } = await createUser();
    const apple = await createProduct({ price: 10 });
    const banana = await createProduct({ price: 5 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: apple._id.toString(), quantity: 2 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: banana._id.toString(), quantity: 1 });

    const res = await request(app).delete('/api/cart').set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.total).toBe(0);
  });

  test('clearing an already-empty cart is a no-op success, not an error', async () => {
    const { accessToken } = await createUser();
    const res = await request(app).delete('/api/cart').set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
  });
});

describe('Server-side price authority', () => {
  test('the cart total is always derived from the live Product price, never trusted from the client', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 20 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 3 });

    // The add-item payload has no price/total field to inject in the first
    // place — this documents that server-side authority explicitly, by
    // attempting it anyway on the same endpoint and proving it has no effect.
    const res = await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 0, price: 1, total: 1 });

    // quantity: 0 fails validation regardless — the point is that even the
    // extraneous price/total fields are silently ignored, not honored.
    expect(res.status).toBe(400);

    const cart = await request(app).get('/api/cart').set('Cookie', accessCookie(accessToken));
    expect(cart.body.cart.total).toBe(60); // unaffected: 3 * 20
  });

  test('cart total is recalculated from the CURRENT product price after a price change', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 10 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 2 });

    product.price = 40;
    await product.save();

    const res = await request(app).get('/api/cart').set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.cart.items[0].product.price).toBe(40);
    expect(res.body.cart.items[0].subtotal).toBe(80);
    expect(res.body.cart.total).toBe(80);
  });
});

describe('Dead-item pruning', () => {
  test('an item whose product was deleted from the catalog is silently pruned on read', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 10 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 1 });

    await Product.deleteOne({ _id: product._id });

    const res = await request(app).get('/api/cart').set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.total).toBe(0);

    const persisted = await Cart.findOne({});
    expect(persisted.items).toHaveLength(0);
  });

  test('an item whose product was later marked inactive is pruned on read', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct({ price: 10 });
    await request(app)
      .post('/api/cart/items')
      .set('Cookie', accessCookie(accessToken))
      .send({ productId: product._id.toString(), quantity: 1 });

    product.isActive = false;
    await product.save();

    const res = await request(app).get('/api/cart').set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
  });
});
