import { CartItem } from './CartItem';

/**
 * Renders the cart's line items. `pendingActions`/`itemErrors` are keyed by
 * product id (see CartContext/cartService — cart items have no id of their
 * own, the product they wrap is the natural key) so one item's in-flight
 * update/remove or error never affects the rest of the list.
 */
export function CartList({ items, pendingActions, itemErrors, onIncrease, onDecrease, onRemove }) {
  return (
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-4 sm:px-6">
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
