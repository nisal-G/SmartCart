import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import { productDetailsPath } from '../../constants/routes';

/** Single product tile used by ProductGrid. Only ever renders fields the backend actually returns. */
export function ProductCard({ product }) {
  const { _id, name, price, description, category, image, isActive } = product;

  return (
    <Link
      to={productDetailsPath(_id)}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-slate-100">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {category?.name && (
          <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            {category.name}
          </span>
        )}
        <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{name}</h3>
        {description && (
          <p className="line-clamp-2 text-sm text-slate-500">{description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-lg font-semibold text-slate-900">{formatCurrency(price)}</span>
          {isActive === false && (
            <span className="text-xs font-medium text-red-600">Unavailable</span>
          )}
        </div>
      </div>
    </Link>
  );
}
