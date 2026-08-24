module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  // mongodb-memory-server needs real time to boot a replica-set mongod.
  testTimeout: 60000,
};
