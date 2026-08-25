import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/**
 * `items` is [{ label, to? }] — the last entry is the current page and is
 * rendered as plain text (never a link to itself), marked aria-current.
 */
export function Breadcrumbs({ items }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <Icon name="chevronRight" size="xs" className="text-slate-300" />}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="rounded-sm transition-colors hover:text-brand-700 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="max-w-[16rem] truncate font-medium text-slate-700" aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
