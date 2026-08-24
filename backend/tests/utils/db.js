const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// A single-member replica set (not a plain standalone MongoMemoryServer) is
// required so tests can exercise the real multi-document transaction used
// by orderController.checkout (Order create + Cart clear) — a standalone
// mongod does not support transactions at all.
let replSet;

async function connect() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}

async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (replSet) await replSet.stop();
}

module.exports = { connect, clearDatabase, closeDatabase };
