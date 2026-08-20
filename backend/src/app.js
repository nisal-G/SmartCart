require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { passport } = require('./config/passport');

const app = express();

// Core middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true, // required so the browser sends/receives the auth cookies
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Feature routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));

// Additional feature routes will be mounted here as they are built.

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// Only connect to MongoDB and start listening when this file is run
// directly (`node src/app.js` / `npm start` / `npm run dev`), so the
// Express app can also be imported elsewhere without side effects.
if (require.main === module) {
  connectDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`SmartCart backend running on port ${PORT}`);
  });
}

module.exports = app;
