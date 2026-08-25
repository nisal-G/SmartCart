/* eslint-disable react-refresh/only-export-components -- see AuthContext.jsx */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import cartService from '../services/cartService';
import { AuthContext } from './AuthContext';

export const CartContext = createContext(null);

const EMPTY_CART = { items: [], total: 0 };

/**
 * Cart state foundation. The cart is server-owned (see
 * backend/src/controllers/cartController.js — totals are always
 * recomputed from live product prices), so this provider is a thin,
 * optimistic-free wrapper: every mutation calls the API and replaces local
 * state with whatever it returns, never computes a total itself.
 *
 * Feature branches building the actual cart UI can consume this via
 * hooks/useCart.js without touching the API layer directly.
 */
export function CartProvider({ children }) {
  // Depends on AuthContext to know when a session exists to load a cart
  // for — CartProvider must be rendered inside AuthProvider.
  const auth = useContext(AuthContext);
  const isAuthenticated = Boolean(auth?.user);

  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load the cart once a session exists. (Logged-out visitors never see
  // `cart` state at all — see `visibleCart` below — so there's nothing to
  // reset here on logout.) Written as an inline promise chain (rather than
  // calling a shared helper) so every setState call is a literal callback
  // passed to .then/.catch/.finally, not a synchronous call in the effect
  // body itself.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let ignore = false;
    Promise.resolve()
      .then(() => {
        if (!ignore) {
          setLoading(true);
          setError(null);
        }
        return cartService.getCart();
      })
      .then((nextCart) => {
        if (!ignore) setCart(nextCart);
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  // Exposed so a page can force a reload after an out-of-band change (e.g.
  // once checkout is implemented and clears the cart server-side).
  const loadCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(EMPTY_CART);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const nextCart = await cartService.getCart();
      setCart(nextCart);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    setCart(await cartService.addItem(productId, quantity));
  }, []);

  const updateItemQuantity = useCallback(async (productId, quantity) => {
    setCart(await cartService.updateItemQuantity(productId, quantity));
  }, []);

  const removeItem = useCallback(async (productId) => {
    setCart(await cartService.removeItem(productId));
  }, []);

  const clearCart = useCallback(async () => {
    setCart(await cartService.clearCart());
  }, []);

  // Derived, not stored: a logged-out visitor (or one who just logged out)
  // never sees a previous session's cart, without needing an extra effect
  // to reset `cart` state on logout.
  const visibleCart = isAuthenticated ? cart : EMPTY_CART;

  const itemCount = useMemo(
    () => visibleCart.items.reduce((sum, item) => sum + item.quantity, 0),
    [visibleCart.items]
  );

  const value = useMemo(
    () => ({
      cart: visibleCart,
      itemCount,
      loading,
      error,
      loadCart,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
    }),
    [visibleCart, itemCount, loading, error, loadCart, addItem, updateItemQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
