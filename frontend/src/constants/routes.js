/**
 * Frontend route paths, centralized so links/redirects never hardcode a
 * path string in more than one place. Keep in sync with routes/AppRoutes.jsx.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth/callback',
  PRODUCTS: '/products',
  PRODUCT_DETAILS: '/products/:id',
  CART: '/cart',
  CHECKOUT: '/checkout',
  ORDERS: '/orders',
  ADMIN: '/admin',
};

/** Builds a concrete product details path from a product id. */
export function productDetailsPath(id) {
  return `/products/${id}`;
}
