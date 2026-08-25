import { Routes, Route } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { ROLES } from '../constants/roles';
import { Home } from '../pages/Home';
import { Login } from '../pages/Login';
import { AuthCallback } from '../pages/AuthCallback';
import { Products } from '../pages/Products';
import { ProductDetails } from '../pages/ProductDetails';
import { Cart } from '../pages/Cart';
import { Checkout } from '../pages/Checkout';
import { Orders } from '../pages/Orders';
import { OrderDetails } from '../pages/OrderDetails';
import { PaymentReturn } from '../pages/PaymentReturn';
import { PaymentCancel } from '../pages/PaymentCancel';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { AdminProducts } from '../pages/admin/AdminProducts';
import { AdminProductForm } from '../pages/admin/AdminProductForm';
import { AdminCategories } from '../pages/admin/AdminCategories';
import { AdminCategoryForm } from '../pages/admin/AdminCategoryForm';
import { AdminOrders } from '../pages/admin/AdminOrders';
import { AdminOrderDetails } from '../pages/admin/AdminOrderDetails';
import { AdminUsers } from '../pages/admin/AdminUsers';
import { NotFound } from '../pages/NotFound';

/**
 * Top-level route table. Kept flat and declarative so adding a real
 * feature later is just swapping a placeholder page for its real one —
 * the route tree itself shouldn't need to change.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetails />} />

        {/* Requires a logged-in shopper */}
        <Route element={<ProtectedRoute />}>
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          {/* PayHere return/cancel URLs (backend/.env PAYHERE_RETURN_URL /
              PAYHERE_CANCEL_URL) — fetch the order, so require a session
              the same as every other order-scoped route. */}
          <Route path="/payment/return" element={<PaymentReturn />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
        </Route>

        {/* Requires a logged-in admin */}
        <Route element={<ProtectedRoute role={ROLES.ADMIN} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="categories/new" element={<AdminCategoryForm />} />
            <Route path="categories/:id/edit" element={<AdminCategoryForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetails />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
