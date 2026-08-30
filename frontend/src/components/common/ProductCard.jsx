import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import { productDetailsPath } from '../../constants/routes';
import { Icon } from '../ui/Icon';
import { classNames } from '../../utils/classNames';

/**
 * Single product tile used by ProductGrid. Only ever renders fields the
 * backend actually returns — no ratings, review counts or "was/now" prices
 * exist in the API, so none are shown.
 *
 * The whole tile is one link (the card is the click target), which is why
 * the trailing affordance is decorative rather than a nested button: a real
 * "add to cart" control here would need its own quantity/auth handling,
 * which lives on the product details page.
 */
export function ProductCard({ product }) {
  const { _id, name, price, description, category, image, isActive } = product;
  const unavailable = isActive === false;

  return (
    <Link
      to={productDetailsPath(_id)}
      className={classNames(
        'group relative flex h-full flex-col overflow-hidden rounded-card border border-slate-200/80 bg-white',
        'shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-entrance',
        'hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-lift'
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 ease-entrance group-hover:scale-[1.07]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-linear-to-br from-slate-50 to-slate-100 text-slate-300">
            <Icon name="package" size="xl" strokeWidth={1.5} />
            <span className="text-xs font-medium text-slate-400">No image</span>
          </div>
        )}

        {/* A soft scrim that only appears on hover — it lifts the tile off
            the grid without dimming the product at rest. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-slate-950/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        {category?.name && (
          <span className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-800 shadow-xs backdrop-blur-sm">
            {category.name}
          </span>
        )}

        {unavailable && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-red-700 shadow-xs ring-1 ring-red-200">
            Unavailable
          </span>
        )}

        {/* Slides up out of the image edge on hover. Decorative: the card
            itself is already the link, and the product name below carries
            the accessible name. */}
        <span
          aria-hidden="true"
          className={classNames(
            'pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-control',
            'bg-white/95 px-3 py-2 text-xs font-bold text-slate-900 shadow-card backdrop-blur-sm',
            'translate-y-3 opacity-0 transition-[opacity,transform] duration-300 ease-entrance',
            'group-hover:translate-y-0 group-hover:opacity-100'
          )}
        >
          View product
          <Icon name="arrowRight" size="xs" strokeWidth={2.25} />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors duration-200 group-hover:text-brand-700 sm:text-base">
          {name}
        </h3>
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
            {description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="text-base font-extrabold tracking-tight tabular-nums text-slate-900 sm:text-lg">
            {formatCurrency(price)}
          </span>
          <span
            className={classNames(
              'flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500',
              'transition-[background-color,color,transform] duration-300 ease-entrance',
              'group-hover:translate-x-0.5 group-hover:bg-brand-600 group-hover:text-white'
            )}
            aria-hidden="true"
          >
            <Icon name="arrowRight" size="sm" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}
