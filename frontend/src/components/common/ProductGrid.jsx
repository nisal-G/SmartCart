import { ProductCard } from './ProductCard';

/** Responsive product grid. Callers own loading/error/empty states — this only renders items. */
export function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product._id} product={product} />
      ))}
    </div>
  );
}
