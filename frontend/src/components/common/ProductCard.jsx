import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import { productDetailsPath } from '../../constants/routes';
import { Icon } from '../ui/Icon';

/**
 * Single product tile used by ProductGrid. Only ever renders fields the
 * backend actually returns — no ratings, review counts or "was/now" prices
 * exist in the API, so none are shown.
 *
 * The whole tile is one link (the card is the click target), which is why
 * the trailing chevron is decorative rather than a nested button: a real
 * "add to cart" control here would need its own quantity/auth handling,
 * which lives on the product details page.
 */
export function ProductCard({ product }) {
  const { _id, name, price, description, category, image, isActive } = product;
  const unavailable = isActive === false;

  return (
    <Link
      to={productDetailsPath(_id)}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card-hover"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
            <Icon name="package" size="xl" strokeWidth={1.5} />
            <span className="text-xs font-medium text-slate-400">No image</span>
          </div>
        )}

        {unavailable && (
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-red-700 shadow-xs ring-1 ring-red-200">
            Unavailable
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {category?.name && (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
            {category.name}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 sm:text-base">
          {name}
        </h3>
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
            {description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="text-base font-bold text-slate-900 sm:text-lg">
            {formatCurrency(price)}
          </span>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white"
            aria-hidden="true"
          >
            <Icon name="chevronRight" size="sm" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}
