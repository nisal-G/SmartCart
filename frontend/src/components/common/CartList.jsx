import { CartItem } from './CartItem';

/**
 * Renders the cart's line items. `pendingActions`/`itemErrors` are keyed by
 * product id (see CartContext/cartService — cart items have no id of their
 * own, the product they wrap is the natural key) so one item's in-flight
 * update/remove or error never affects the rest of the list.
 */
export function CartList({ items, pendingActions, itemErrors, onIncrease, onDecrease, onRemove }) {
  return (
    <ul className="divide-y divide-slate-200/80 rounded-panel border border-slate-200/80 bg-white px-5 py-2 shadow-card sm:px-7 sm:py-3">
      {items.map((item) => {
        const productId = item.product.id;
        return (
          <CartItem
            key={productId}
            item={item}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            onRemove={onRemove}
            isUpdating={pendingActions[productId] === 'update'}
            isRemoving={pendingActions[productId] === 'remove'}
            errorMessage={itemErrors[productId]}
          />
        );
      })}
    </ul>
  );
}
