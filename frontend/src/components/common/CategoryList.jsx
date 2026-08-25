import { classNames } from '../../utils/classNames';

const PILL_BASE =
  'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
const PILL_ACTIVE = 'border-indigo-600 bg-indigo-600 text-white';
const PILL_INACTIVE = 'border-slate-300 text-slate-600 hover:bg-slate-50';

/**
 * Horizontal category filter bar for the Products page. `activeCategory` is
 * a category id (or null for "All"); `onSelect` is called with that same
 * shape. Scrolls horizontally on small screens instead of wrapping/clipping.
 */
export function CategoryList({ categories, activeCategory, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Product categories">
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
