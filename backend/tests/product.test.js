const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const imageStorageService = require('../src/services/imageStorageService');
const { connect, clearDatabase, closeDatabase } = require('./utils/db');
const { createUser, createAdmin, accessCookie } = require('./utils/auth');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await closeDatabase();
});

function nonExistentId() {
  return new mongoose.Types.ObjectId().toString();
}

let categorySeq = 0;
async function createCategory(overrides = {}) {
  categorySeq += 1;
  return Category.create({ name: overrides.name || `Category ${categorySeq}-${Date.now()}` });
}

async function createProduct(overrides = {}) {
  const category = overrides.category || (await createCategory());
  return Product.create({
    name: overrides.name || 'Test Product',
    description: overrides.description || 'A product used in tests',
    price: overrides.price ?? 100,
    category: category._id,
    image: overrides.image,
    isActive: overrides.isActive,
  });
}

describe('GET /api/products (public browsing)', () => {
  test('lists products with default pagination, no auth required', async () => {
    await createProduct({ name: 'A' });
    await createProduct({ name: 'B' });

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });

  test('paginates correctly across pages', async () => {
    const category = await createCategory();
    await Promise.all(
      Array.from({ length: 15 }, (_, i) => createProduct({ name: `Product ${i}`, category, price: 10 }))
    );

    const page1 = await request(app).get('/api/products').query({ page: 1, limit: 10 });
    expect(page1.body.products).toHaveLength(10);
    expect(page1.body.pagination).toMatchObject({ page: 1, limit: 10, total: 15, totalPages: 2 });

    const page2 = await request(app).get('/api/products').query({ page: 2, limit: 10 });
    expect(page2.body.products).toHaveLength(5);
    expect(page2.body.pagination.page).toBe(2);
  });

  test('filters by category', async () => {
    const categoryA = await createCategory({ name: 'Fruits' });
    const categoryB = await createCategory({ name: 'Cakes' });
    await createProduct({ name: 'Apple', category: categoryA });
    await createProduct({ name: 'Sponge Cake', category: categoryB });

    const res = await request(app).get('/api/products').query({ category: categoryA._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Apple');
  });

  test('searches by name, case-insensitively', async () => {
    await createProduct({ name: 'Red Apple' });
    await createProduct({ name: 'Green Apple' });
    await createProduct({ name: 'Banana' });

    const res = await request(app).get('/api/products').query({ search: 'apple' });

    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.name).sort()).toEqual(['Green Apple', 'Red Apple']);
  });

  test('filters by minPrice/maxPrice range', async () => {
    await createProduct({ name: 'Cheap', price: 10 });
    await createProduct({ name: 'Mid', price: 50 });
    await createProduct({ name: 'Expensive', price: 100 });

    const res = await request(app).get('/api/products').query({ minPrice: 20, maxPrice: 80 });

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Mid');
  });

  test('400 for an invalid pagination/filter query', async () => {
    const res = await request(app).get('/api/products').query({ limit: 0 });
    expect(res.status).toBe(400);
  });

  test('an inactive product is still returned by the public listing (no API-level filtering by isActive today)', async () => {
    await createProduct({ name: 'Discontinued', isActive: false });
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
  });
});

describe('GET /api/products/:id', () => {
  test('returns a single product with its category populated, no auth required', async () => {
    const category = await createCategory({ name: 'Fruits' });
    const product = await createProduct({ name: 'Apple', category, price: 30 });

    const res = await request(app).get(`/api/products/${product._id}`);

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe('Apple');
    expect(res.body.product.category.name).toBe('Fruits');
  });

  test('404 for a well-formed id that does not exist', async () => {
    const res = await request(app).get(`/api/products/${nonExistentId()}`);
    expect(res.status).toBe(404);
  });

  test('400 for a malformed id', async () => {
    const res = await request(app).get('/api/products/not-an-id');
    expect(res.status).toBe(400);
  });

  test('an inactive product is still individually retrievable (no API-level filtering by isActive today)', async () => {
    const product = await createProduct({ isActive: false });
    const res = await request(app).get(`/api/products/${product._id}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/products/category/:categoryId', () => {
  test('lists products in a category, sorted by name', async () => {
    const category = await createCategory({ name: 'Fruits' });
    await createProduct({ name: 'Banana', category });
    await createProduct({ name: 'Apple', category });

    const res = await request(app).get(`/api/products/category/${category._id}`);

    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.name)).toEqual(['Apple', 'Banana']);
  });

  test('returns an empty array for a category with no products', async () => {
    const category = await createCategory();
    const res = await request(app).get(`/api/products/category/${category._id}`);
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  test('404 for a non-existent category', async () => {
    const res = await request(app).get(`/api/products/category/${nonExistentId()}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/products (admin only)', () => {
  test('401 when unauthenticated', async () => {
    const category = await createCategory();
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Apple', price: 10, category: category._id.toString() });
    expect(res.status).toBe(401);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const category = await createCategory();
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Apple', price: 10, category: category._id.toString() });
    expect(res.status).toBe(403);
  });

  test('admin can create a product tied to a category', async () => {
    const { accessToken } = await createAdmin();
    const category = await createCategory({ name: 'Fruits' });

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Apple', description: 'Crisp and red', price: 25, category: category._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('Apple');
    expect(res.body.product.price).toBe(25);
    expect(await Product.countDocuments({})).toBe(1);
  });

  test('404 when the category does not exist', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Apple', price: 10, category: nonExistentId() });
    expect(res.status).toBe(404);
  });

  test('400 when required fields are missing', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .send({ description: 'no name/price/category' });
    expect(res.status).toBe(400);
  });

  test('400 for a non-positive price', async () => {
    const { accessToken } = await createAdmin();
    const category = await createCategory();
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Free Item', price: 0, category: category._id.toString() });
    expect(res.status).toBe(400);
  });

  test('400 for an invalid category id', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Apple', price: 10, category: 'not-an-id' });
    expect(res.status).toBe(400);
  });

  test('admin can create a product with an uploaded image file (image storage mocked)', async () => {
    const { accessToken } = await createAdmin();
    const category = await createCategory();
    const uploadSpy = jest.spyOn(imageStorageService, 'uploadImage').mockResolvedValue({
      path: 'products/mock-uuid.png',
      url: 'https://mock.supabase.test/storage/v1/object/public/mock-bucket/products/mock-uuid.png',
    });

    const res = await request(app)
      .post('/api/products')
      .set('Cookie', accessCookie(accessToken))
      .field('name', 'Apple')
      .field('price', '10')
      .field('category', category._id.toString())
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'apple.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.product.image).toContain('mock-bucket');
    expect(uploadSpy).toHaveBeenCalledWith('products', expect.objectContaining({ originalname: 'apple.png' }));
  });
});

describe('PUT /api/products/:id (admin only)', () => {
  test('admin can update fields', async () => {
    const { accessToken } = await createAdmin();
    const product = await createProduct({ name: 'Apple', price: 10 });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ price: 15 });

    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe(15);
    expect(res.body.product.name).toBe('Apple');
  });

  test('admin can move a product to a different category', async () => {
    const { accessToken } = await createAdmin();
    const originalCategory = await createCategory({ name: 'Fruits' });
    const newCategory = await createCategory({ name: 'Snacks' });
    const product = await createProduct({ category: originalCategory });

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ category: newCategory._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.product.category._id).toBe(String(newCategory._id));
  });

  test('404 when moving a product to a non-existent category', async () => {
    const { accessToken } = await createAdmin();
    const product = await createProduct();

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ category: nonExistentId() });

    expect(res.status).toBe(404);
  });

  test('404 for a non-existent product', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .put(`/api/products/${nonExistentId()}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ price: 5 });
    expect(res.status).toBe(404);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct();
    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ price: 5 });
    expect(res.status).toBe(403);
  });

  test('replacing the image deletes the previous one from storage', async () => {
    const { accessToken } = await createAdmin();
    const product = await createProduct({ image: 'https://old.example.com/img.png' });
    const deleteSpy = jest.spyOn(imageStorageService, 'deleteImageByUrl').mockResolvedValue(undefined);

    const res = await request(app)
      .put(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ image: 'https://new.example.com/img.png' });

    expect(res.status).toBe(200);
    await new Promise((resolve) => setImmediate(resolve));
    expect(deleteSpy).toHaveBeenCalledWith('https://old.example.com/img.png');
  });
});

describe('DELETE /api/products/:id (admin only)', () => {
  test('admin can delete a product and its image is cleaned up from storage', async () => {
    const { accessToken } = await createAdmin();
    const product = await createProduct({ image: 'https://example.com/img.png' });
    const deleteSpy = jest.spyOn(imageStorageService, 'deleteImageByUrl').mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(await Product.findById(product._id)).toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    expect(deleteSpy).toHaveBeenCalledWith('https://example.com/img.png');
  });

  test('404 for a non-existent product', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .delete(`/api/products/${nonExistentId()}`)
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(404);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const product = await createProduct();
    const res = await request(app)
      .delete(`/api/products/${product._id}`)
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(403);
    expect(await Product.findById(product._id)).not.toBeNull();
  });

  test('401 when unauthenticated', async () => {
    const product = await createProduct();
    const res = await request(app).delete(`/api/products/${product._id}`);
    expect(res.status).toBe(401);
  });
});
