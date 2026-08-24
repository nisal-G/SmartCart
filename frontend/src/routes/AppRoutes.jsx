import { Routes, Route } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
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
import { Admin } from '../pages/Admin';
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
        </Route>

        {/* Requires a logged-in admin */}
        <Route element={<ProtectedRoute role={ROLES.ADMIN} />}>
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
