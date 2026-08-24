const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
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

/** A syntactically valid Mongo ObjectId that doesn't exist in the DB. */
function nonExistentId() {
  return new mongoose.Types.ObjectId().toString();
}

describe('GET /api/categories', () => {
  test('public: lists categories sorted by name, no auth required', async () => {
    await Category.create([{ name: 'Vegetables' }, { name: 'Cakes' }, { name: 'Biscuits' }]);

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.name)).toEqual(['Biscuits', 'Cakes', 'Vegetables']);
  });

  test('returns an empty list when there are no categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });
});

describe('GET /api/categories/:id', () => {
  test('public: returns a single category, no auth required', async () => {
    const category = await Category.create({ name: 'Fruits', description: 'Fresh fruit' });

    const res = await request(app).get(`/api/categories/${category._id}`);

    expect(res.status).toBe(200);
    expect(res.body.category._id).toBe(String(category._id));
    expect(res.body.category.name).toBe('Fruits');
  });

  test('404 for a well-formed id that does not exist', async () => {
    const res = await request(app).get(`/api/categories/${nonExistentId()}`);
    expect(res.status).toBe(404);
  });

  test('400 for a malformed id', async () => {
    const res = await request(app).get('/api/categories/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/categories (admin only)', () => {
  test('401 when unauthenticated', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Fruits' });
    expect(res.status).toBe(401);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Fruits' });
    expect(res.status).toBe(403);
  });

  test('admin can create a category with a JSON image URL', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Fruits', description: 'Fresh fruit', image: 'https://example.com/fruit.png' });

    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe('Fruits');
    expect(res.body.category.image).toBe('https://example.com/fruit.png');

    const inDb = await Category.findById(res.body.category._id);
    expect(inDb).not.toBeNull();
  });

  test('400 when name is missing', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .send({ description: 'no name given' });
    expect(res.status).toBe(400);
  });

  test('400 when name exceeds the max length', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'x'.repeat(51) });
    expect(res.status).toBe(400);
  });

  test('409 on a duplicate category name, case-insensitively', async () => {
    const { accessToken } = await createAdmin();
    await Category.create({ name: 'Vegetables' });

    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'vegetables' });

    expect(res.status).toBe(409);
    expect(await Category.countDocuments({})).toBe(1);
  });

  test('admin can create a category with an uploaded image file (image storage mocked)', async () => {
    const { accessToken } = await createAdmin();
    const uploadSpy = jest.spyOn(imageStorageService, 'uploadImage').mockResolvedValue({
      path: 'categories/mock-uuid.png',
      url: 'https://mock.supabase.test/storage/v1/object/public/mock-bucket/categories/mock-uuid.png',
    });

    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .field('name', 'Cakes')
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'cake.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.category.image).toContain('mock-bucket');
    expect(uploadSpy).toHaveBeenCalledWith(
      'categories',
      expect.objectContaining({ originalname: 'cake.png' })
    );
  });

  test('rejects a disallowed file type on upload', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .field('name', 'Cakes')
      .attach('image', Buffer.from('not an image'), { filename: 'malware.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
  });

  test('returns the image service error status/message when the upload fails (controlled 5xx preserved)', async () => {
    const { accessToken } = await createAdmin();
    jest
      .spyOn(imageStorageService, 'uploadImage')
      .mockRejectedValue(Object.assign(new Error('Failed to upload image'), { status: 502 }));

    const res = await request(app)
      .post('/api/categories')
      .set('Cookie', accessCookie(accessToken))
      .field('name', 'Biscuits')
      .attach('image', Buffer.from('fake-png-bytes'), { filename: 'b.png', contentType: 'image/png' });

    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Failed to upload image');
    expect(await Category.countDocuments({})).toBe(0);
  });
});

describe('PUT /api/categories/:id (admin only)', () => {
  test('admin can update name/description', async () => {
    const { accessToken } = await createAdmin();
    const category = await Category.create({ name: 'Snacks' });

    const res = await request(app)
      .put(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.category.description).toBe('Updated description');
    expect(res.body.category.name).toBe('Snacks');
  });

  test('409 when renaming to a name that collides case-insensitively with another category', async () => {
    const { accessToken } = await createAdmin();
    await Category.create({ name: 'Fruits' });
    const category = await Category.create({ name: 'Snacks' });

    const res = await request(app)
      .put(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'FRUITS' });

    expect(res.status).toBe(409);
  });

  test('renaming a category to its own (unchanged) name does not conflict with itself', async () => {
    const { accessToken } = await createAdmin();
    const category = await Category.create({ name: 'Snacks' });

    const res = await request(app)
      .put(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ name: 'Snacks', description: 'still snacks' });

    expect(res.status).toBe(200);
  });

  test('404 for a non-existent category', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .put(`/api/categories/${nonExistentId()}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ description: 'x' });
    expect(res.status).toBe(404);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const category = await Category.create({ name: 'Snacks' });

    const res = await request(app)
      .put(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ description: 'x' });

    expect(res.status).toBe(403);
  });

  test('replacing the image deletes the previous one from storage', async () => {
    const { accessToken } = await createAdmin();
    const category = await Category.create({ name: 'Snacks', image: 'https://old.example.com/img.png' });
    const deleteSpy = jest.spyOn(imageStorageService, 'deleteImageByUrl').mockResolvedValue(undefined);

    const res = await request(app)
      .put(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken))
      .send({ image: 'https://new.example.com/img.png' });

    expect(res.status).toBe(200);
    // cleanup is fire-and-forget (see categoryController.cleanupImage) — give
    // the microtask queue a tick before asserting it ran.
    await new Promise((resolve) => setImmediate(resolve));
    expect(deleteSpy).toHaveBeenCalledWith('https://old.example.com/img.png');
  });
});

describe('DELETE /api/categories/:id (admin only)', () => {
  test('admin can delete a category and its image is cleaned up from storage', async () => {
    const { accessToken } = await createAdmin();
    const category = await Category.create({ name: 'Snacks', image: 'https://example.com/img.png' });
    const deleteSpy = jest.spyOn(imageStorageService, 'deleteImageByUrl').mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(200);
    expect(await Category.findById(category._id)).toBeNull();
    await new Promise((resolve) => setImmediate(resolve));
    expect(deleteSpy).toHaveBeenCalledWith('https://example.com/img.png');
  });

  test('404 for a non-existent category', async () => {
    const { accessToken } = await createAdmin();
    const res = await request(app)
      .delete(`/api/categories/${nonExistentId()}`)
      .set('Cookie', accessCookie(accessToken));
    expect(res.status).toBe(404);
  });

  test('403 for an authenticated non-admin user', async () => {
    const { accessToken } = await createUser();
    const category = await Category.create({ name: 'Snacks' });

    const res = await request(app)
      .delete(`/api/categories/${category._id}`)
      .set('Cookie', accessCookie(accessToken));

    expect(res.status).toBe(403);
    expect(await Category.findById(category._id)).not.toBeNull();
  });

  test('401 when unauthenticated', async () => {
    const category = await Category.create({ name: 'Snacks' });
    const res = await request(app).delete(`/api/categories/${category._id}`);
    expect(res.status).toBe(401);
  });
});
