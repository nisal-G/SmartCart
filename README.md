# SmartCart

SmartCart is a full-stack online shopping cart application: a customer-facing storefront (product browsing, cart, checkout, order tracking, PayHere payments) plus an admin console (catalog, order, and user management), built on a React SPA frontend and an Express/MongoDB REST API backend.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
- [Authentication](#authentication)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security Notes](#security-notes)

## Overview

SmartCart lets shoppers browse a categorized product catalog, manage a cart, check out into an order, and pay via the PayHere payment gateway. Admins manage categories, products, orders, and user accounts through a separate admin area of the same SPA. The backend is a stateless REST API (Node.js/Express) backed by MongoDB, and the frontend is a Vite-built React single-page app.

## Tech Stack

**Backend** (`backend/`)
- Node.js, Express 5
- MongoDB with Mongoose 9 (ODM)
- Authentication: JSON Web Tokens (`jsonwebtoken`) via httpOnly cookies, `passport` with `passport-google-oauth20` and `passport-facebook` for social login, `@simplewebauthn/server` for Passkey/WebAuthn login, `bcryptjs` for admin password hashing
- `express-validator` for request validation, `helmet` for HTTP security headers, `cors`, `cookie-parser`, `express-rate-limit` for rate limiting
- `multer` for multipart image uploads, `@supabase/supabase-js` for image storage (Supabase Storage)
- `pino` / `pino-http` for structured logging
- Testing: `jest`, `supertest`, `mongodb-memory-server`; load testing via `autocannon`

**Frontend** (`frontend/`)
- React 19, React Router 7
- Vite 8 as the build tool/dev server
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- `axios` for API calls
- `@simplewebauthn/browser` for Passkey/WebAuthn registration and login in the browser
- Testing: Playwright for end-to-end tests, ESLint for linting

## Architecture

```
┌───────────────────────┐        HTTPS / JSON (cookies)        ┌────────────────────────┐
│   React SPA (Vite)     │ ────────────────────────────────────▶│   Express REST API      │
│   frontend/            │◀──────────────────────────────────── │   backend/               │
└───────────┬────────────┘                                      └────────────┬─────────────┘
            │                                                                  │
            │ Vercel (SPA hosting, /vercel.json SPA rewrite)                   │ Mongoose
            ▼                                                                  ▼
      Static hosting                                                  ┌───────────────┐
                                                                        │   MongoDB      │
                                                                        └───────────────┘
                                                        │                        │
                                          Google / Facebook OAuth        Supabase Storage
                                          (passport strategies)          (product/category images)
                                                        │
                                                 PayHere Payment Gateway
                                             (checkout session + server-verified
                                              notify webhook)
```

The frontend never talks to MongoDB, Supabase, or PayHere directly — every external integration is proxied and authorized through the backend API. Sessions are carried via httpOnly cookies (`withCredentials: true` on the shared Axios instance), not `Authorization` headers.

## Project Structure

```
SmartCart/
├── backend/
│   ├── src/
│   │   ├── app.js                # Express app: middleware, route mounting, error handling
│   │   ├── config/                # DB, CORS, cookies, frontend origin, passport, logger, Supabase
│   │   ├── controllers/           # Route handlers (auth, cart, category, order, payment, product, user)
│   │   ├── middleware/            # authenticate, authorize (RBAC), rate limiting, validation, upload, error handler
│   │   ├── models/                 # Mongoose schemas: User, Product, Category, Cart, Order, WebAuthnChallenge
│   │   ├── routes/                # Express routers, one per resource
│   │   ├── services/               # tokenService, webauthnService, payhereService, imageStorageService, oauth state/code stores
│   │   ├── validators/             # express-validator chains per resource
│   │   ├── utils/                  # asyncHandler, traceRef
│   │   └── scripts/                # seedAdmin.js, loadtest.js
│   └── tests/                      # Jest + Supertest integration tests (auth, cart, orders, payments, products, security, rate limiting)
└── frontend/
    ├── src/
    │   ├── pages/                  # Route-level screens (customer + admin/*)
    │   ├── components/             # common, layout, ui, home, admin, motion component groups
    │   ├── context/                # AuthContext, CartContext, ToastContext
    │   ├── hooks/                  # useAuth, useCart, useToast, usePaymentStatus, ...
    │   ├── services/                # Axios-based API clients (authService, cartService, productService, ...)
    │   ├── routes/                  # AppRoutes.jsx (route table), ProtectedRoute.jsx (auth/role guard)
    │   ├── layouts/                 # MainLayout, AdminLayout
    │   └── constants/                # routes, roles, order statuses, OAuth error codes
    └── tests/                       # Playwright end-to-end suites (customer, admin, auth, payment, security, regression, responsive)
```

## Core Features

**Customer-facing**
- Browse categories and products (public, no login required)
- Product detail pages
- Cart management (add, update quantity, remove, clear) — server-authoritative pricing, recomputed from live product prices
- Checkout — converts the cart into an Order with a server-computed total and price/name snapshots per line item
- Order history and order detail views
- Payment via PayHere (hosted checkout) with return/cancel pages that re-fetch order status from the backend rather than trusting the redirect
- Sign in with Google, Facebook, or a Passkey (WebAuthn) — no traditional password signup for shoppers

**Admin console** (role-gated, under `/admin`)
- Dashboard
- Category management (create/update/delete, with image upload)
- Product management (create/update/delete, with image upload, scoped to a category)
- Order management (view all orders, update fulfillment status)
- User management (list users, activate/suspend accounts)
- Separate admin login (email/password)

## Authentication

SmartCart supports three ways to sign in, all issuing the same session:

1. **Google / Facebook OAuth** (`passport-google-oauth20`, `passport-facebook`) — social login for shoppers. OAuth `state` is verified against a server-side store before any authorization code is exchanged, and each code is claimed exactly once (`oauthCodeGuard`) to prevent replay. OAuth sign-in never grants the `admin` role.
2. **Passkeys / WebAuthn** (`@simplewebauthn/server` + `@simplewebauthn/browser`) — passwordless registration and login using the device's platform authenticator or a security key. Challenges are short-lived (5-minute TTL, `WebAuthnChallenge` collection).
3. **Admin email/password** — `bcryptjs`-hashed password login, for accounts provisioned via `npm run seed:admin`. There is no public admin registration endpoint.

**Session mechanics** (`backend/src/services/tokenService.js`):
- A short-lived **access token** (JWT, default 15 min) is set as an httpOnly `accessToken` cookie on `/`.
- A rotating, opaque **refresh token** is set as an httpOnly `refreshToken` cookie scoped to `/api/auth` only. Only its SHA-256 hash is stored server-side (in `User.refreshTokens`); each use consumes and replaces it.
- `POST /api/auth/refresh` mints a new access/refresh pair when the access token expires; the frontend's Axios interceptor (`frontend/src/services/api.js`) does this transparently on a `401 TOKEN_EXPIRED` response and retries the original request once.
- Cookie `SameSite`/`Secure` attributes are derived automatically from whether the configured frontend is same-site or cross-site (see `backend/src/config/cookies.js`), so the same code works for local dev (`localhost`, `SameSite=Lax`, non-secure) and a split deployment like Vercel + Render (`SameSite=None; Secure`).
- Authorization is role-based (`user` / `admin`) via the `authorize` middleware; most catalog reads are public, cart/orders are owner-scoped, and catalog/order/user management is admin-only.

## API Reference

Base path: `/api` (see `backend/src/app.js`). All routes below are prefixed with it.

| Resource | Routes |
|---|---|
| **Auth** (`/auth`) | `GET /google`, `GET /google/callback` · `GET /facebook`, `GET /facebook/callback` · `POST /passkey/register/options`, `POST /passkey/register/verify` · `POST /passkey/login/options`, `POST /passkey/login/verify` · `POST /admin/login` · `POST /refresh` · `POST /logout` · `GET /me` |
| **Categories** (`/categories`) | `GET /`, `GET /:id` (public) · `POST /`, `PUT /:id`, `DELETE /:id` (admin) |
| **Products** (`/products`) | `GET /`, `GET /category/:categoryId`, `GET /:id` (public) · `POST /`, `PUT /:id`, `DELETE /:id` (admin) |
| **Cart** (`/cart`) | `GET /`, `POST /items`, `PUT /items/:productId`, `DELETE /items/:productId`, `DELETE /` (authenticated shopper) |
| **Orders** (`/orders`) | `POST /` (checkout), `GET /` (my orders), `GET /:id` (authenticated) · `GET /all`, `GET /all/:id`, `PATCH /:id/status` (admin) |
| **Payments** (`/payments`) | `POST /payhere/notify` (public, PayHere server webhook — signature-verified) · `POST /payhere/session` (authenticated, creates a checkout session for one of the caller's own orders) |
| **Users** (`/users`) | `GET /`, `PATCH /:id/status` (admin only) |

Product/category creation and update accept either a JSON body with `image` as a URL string, or `multipart/form-data` with an `image` file (handled by `multer` + Supabase Storage upload).

## Data Models

Mongoose schemas in `backend/src/models/`:

- **User** — name, email, optional password (admin only), linked OAuth provider IDs, registered passkeys, hashed rotating refresh tokens, `role` (`user`/`admin`), `status` (`pending`/`active`/`suspended`).
- **Category** — name (case-insensitively unique), description, image URL, creator reference.
- **Product** — name, description, price, category reference, image URL, `isActive` flag, creator reference.
- **Cart** — one per user (unique index), line items referencing `Product` + quantity, denormalized `total` recomputed from live product prices.
- **Order** — line items with a price/name **snapshot** taken at checkout (independent of later product changes), server-computed `total`, fulfillment `status` (`pending`/`confirmed`/`cancelled`), and a nested `payment` sub-document tracking the PayHere lifecycle (`pending`/`paid`/`failed`/`cancelled`/`charged_back`).
- **WebAuthnChallenge** — short-lived (TTL-indexed, 5 min) challenge storage for WebAuthn registration/authentication ceremonies.

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- A MongoDB instance (local or Atlas)
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev             # nodemon, auto-restarts on change
# or: npm start
```

The API listens on `PORT` (default `5000`).

To create an admin account (no public admin signup endpoint exists):

```bash
npm run seed:admin -- --email admin@example.com --password "Str0ng!Pass" --name "Site Admin"
# or set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env and run with no flags
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL to point at the backend
npm run dev              # Vite dev server, default http://localhost:5173
```

### Build

```bash
cd frontend
npm run build            # outputs to frontend/dist
npm run preview           # serve the production build locally
```

## Environment Variables

### Backend (`backend/.env`, see `backend/.env.example` for full inline documentation)

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | Server port and environment |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_DAYS` | JWT signing secret and token lifetimes |
| `COOKIE_DOMAIN`, `COOKIE_SAMESITE`, `COOKIE_SECURE` | Cookie scoping overrides (auto-derived from `FRONTEND_URL` if unset) |
| `FRONTEND_URL` | Allowed frontend origin(s) for CORS, cookie decisions, and OAuth redirects (comma-separated; required in production) |
| `OAUTH_SUCCESS_PATH`, `OAUTH_FAILURE_PATH` | Frontend paths the OAuth callback redirects to |
| `LOG_LEVEL` | pino log level override |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth (login disabled/503 if unset) |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL` | Facebook OAuth (login disabled/503 if unset) |
| `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | Passkey/WebAuthn relying-party configuration |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Optional defaults for `npm run seed:admin` |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET` | Supabase Storage for product/category images (upload endpoints return 503 if unset) |
| `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_SANDBOX`, `PAYHERE_CURRENCY`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL`, `PAYHERE_NOTIFY_URL` | PayHere payment gateway configuration (payment endpoints return 503 if unset) |

### Frontend (`frontend/.env`, see `frontend/.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API, e.g. `http://localhost:5000/api` |

## Testing

**Backend** — Jest + Supertest against an in-memory MongoDB (`mongodb-memory-server`):

```bash
cd backend
npm test
```

Covers auth (password, OAuth, passkey), cart, categories, orders, payments (including PayHere signature verification), products, users, rate limiting, and a dedicated security test suite.

A basic load test script is also available:

```bash
npm run loadtest
```

**Frontend** — Playwright end-to-end tests, which boot an ephemeral copy of the real backend against an in-memory MongoDB (never the real database):

```bash
cd frontend
npm run test:e2e            # headless run
npm run test:e2e:ui          # interactive UI mode
npm run test:e2e:report      # view the last HTML report
```

Suites cover customer flows (browsing, cart, checkout, orders), admin flows (products, categories, orders, dashboard), auth/session/authorization, PayHere payment flows, responsiveness, and regressions (navigation, refresh, console errors, URL state).

## Deployment

- **Frontend**: configured for static hosting on Vercel (`frontend/vercel.json` rewrites all paths to `/index.html` for client-side routing). Build with `npm run build` and deploy the `dist/` output.
- **Backend**: a standard Node process (`npm start`) suitable for platforms like Render/Heroku that terminate TLS at a proxy — `app.set('trust proxy', 1)` is already configured so client IPs (for rate limiting) and the request protocol (for OAuth callback URLs) resolve correctly behind one proxy hop.
- Set `FRONTEND_URL` (and every provider-specific env var in use) on the backend deployment; the server refuses to start in production without `FRONTEND_URL` configured.
- Set `VITE_API_BASE_URL` on the frontend deployment to the deployed backend's `/api` URL.
- PayHere's `PAYHERE_NOTIFY_URL` must be a publicly reachable URL (PayHere calls it server-to-server); use a tunnel such as ngrok for local end-to-end payment testing.

## Security Notes

- Passwords are hashed with `bcryptjs` (cost factor 12); refresh tokens are stored only as SHA-256 hashes, never in plaintext.
- `helmet` sets standard security headers; CORS is a strict origin allow-list (no wildcard reflection) derived from `FRONTEND_URL`.
- Two-tier rate limiting: a general limiter on all `/api` routes, plus a stricter limiter on credential-guessing-prone auth routes (`authLimiter`).
- PayHere payment status is only ever written from a server-verified webhook notification (`md5sig` signature check) — never trusted from the client or a redirect URL.
- All cart/order totals are computed server-side from live/snapshotted product data — the client never supplies a trusted price or total.
- Structured logs (`pino`) redact cookies, tokens, passwords, and the PayHere merchant secret at the logger level.
