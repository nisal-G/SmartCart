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
  ORDER_DETAILS: '/orders/:id',
  // Must match backend .env PAYHERE_RETURN_URL / PAYHERE_CANCEL_URL exactly
  // — PayHere redirects the shopper's browser to these verbatim.
  PAYMENT_RETURN: '/payment/return',
  PAYMENT_CANCEL: '/payment/cancel',
  ADMIN: '/admin',
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_PRODUCT_NEW: '/admin/products/new',
  ADMIN_PRODUCT_EDIT: '/admin/products/:id/edit',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_CATEGORY_NEW: '/admin/categories/new',
  ADMIN_CATEGORY_EDIT: '/admin/categories/:id/edit',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ORDER_DETAILS: '/admin/orders/:id',
  ADMIN_USERS: '/admin/users',
};

/** Builds a concrete product details path from a product id. */
export function productDetailsPath(id) {
  return `/products/${id}`;
}

/** Builds a concrete order details path from an order id. */
export function orderDetailsPath(id) {
  return `/orders/${id}`;
}

/** Builds a concrete admin "edit product" path from a product id. */
export function adminProductEditPath(id) {
  return `/admin/products/${id}/edit`;
}

/** Builds a concrete admin "edit category" path from a category id. */
export function adminCategoryEditPath(id) {
  return `/admin/categories/${id}/edit`;
}

/** Builds a concrete admin order details path from an order id. */
export function adminOrderDetailsPath(id) {
  return `/admin/orders/${id}`;
}
