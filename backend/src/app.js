require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const connectDB = require('./config/db');
const logger = require('./config/logger');
const { corsOptions } = require('./config/cors');
const { passport } = require('./config/passport');
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Core middleware
app.use(
  helmet({
    // The API is intentionally consumed cross-origin (a separate frontend
    // origin, gated by the `corsOptions` allow-list below, not by CORP) —
    // helmet's 'same-origin' default would have browsers block the
    // frontend from reading otherwise-legitimate, CORS-approved responses.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use(passport.initialize());

// General API rate limiting (SRS §4 Security NFR). Auth's own routes keep
// their stricter, credential-guessing-focused authLimiter on top of this
// (see routes/authRoutes.js) — this one is a much looser ceiling against
// scripted scraping/abuse of the rest of the API.
app.use('/api', generalLimiter);

// Feature routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));

// Additional feature routes will be mounted here as they are built.

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Only connect to MongoDB and start listening when this file is run
// directly (`node src/app.js` / `npm start` / `npm run dev`), so the
// Express app can also be imported elsewhere without side effects.
if (require.main === module) {
  connectDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    logger.info(`SmartCart backend running on port ${PORT}`);
  });
}

module.exports = app;
