import { classNames } from '../../utils/classNames';

const PILL_BASE = classNames(
  'shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold',
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-standard',
  'hover:-translate-y-px',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'
);
const PILL_ACTIVE = 'border-brand-600 bg-brand-600 text-white shadow-brand';
const PILL_INACTIVE =
  'border-slate-200 bg-white text-slate-700 shadow-xs hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800';

/**
 * Horizontal category filter bar for the Products page. `activeCategory` is
 * a category id (or null for "All"); `onSelect` is called with that same
 * shape. Scrolls horizontally on small screens instead of wrapping/clipping.
 */
export function CategoryList({ categories, activeCategory, onSelect }) {
  return (
    <div
      className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none sm:mx-0 sm:px-0"
      role="tablist"
      aria-label="Product categories"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!activeCategory}
        onClick={() => onSelect(null)}
        className={classNames(PILL_BASE, !activeCategory ? PILL_ACTIVE : PILL_INACTIVE)}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category._id}
          type="button"
          role="tab"
          aria-selected={activeCategory === category._id}
          onClick={() => onSelect(category._id)}
          className={classNames(
            PILL_BASE,
            activeCategory === category._id ? PILL_ACTIVE : PILL_INACTIVE
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
