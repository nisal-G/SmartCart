import { classNames } from '../../utils/classNames';

/**
 * Shared chrome for the admin list views. Every admin table renders the
 * same way — one card surface, one header treatment, one row height, one
 * hover state — so Products, Categories, Orders and Users can't drift into
 * four slightly different tables.
 *
 * The desktop table and the mobile card list are two presentations of the
 * same rows: `AdminTable` is hidden below `md`, `AdminCardList` above it,
 * so exactly one is in the accessibility tree at any width (the E2E suite
 * relies on that — see tests/admin/admin-products.spec.js's note).
 */
export function AdminTable({ head, children, className }) {
  return (
    <div
      className={classNames(
        'hidden overflow-x-auto rounded-card border border-slate-200 bg-white shadow-card md:block',
        className
      )}
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-16 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

/** Header cell. `align="right"` for the actions column. */
export function Th({ align = 'left', className, children }) {
  return (
    <th
      scope="col"
      className={classNames(
        'whitespace-nowrap px-5 py-3.5 font-semibold',
        align === 'right' && 'text-right',
        className
      )}
    >
      {children}
    </th>
  );
}

/** Body cell. */
export function Td({ align = 'left', className, children, ...props }) {
  return (
    <td
      className={classNames('px-5 py-4 align-middle', align === 'right' && 'text-right', className)}
      {...props}
    >
      {children}
    </td>
  );
}

/** Row with the shared hover treatment. */
export function Tr({ className, children }) {
  return (
    <tr className={classNames('transition-colors duration-150 hover:bg-slate-50/80', className)}>
      {children}
    </tr>
  );
}

/** Mobile counterpart to AdminTable — the same records as stacked cards. */
export function AdminCardList({ children }) {
  return <div className="flex flex-col gap-3 md:hidden">{children}</div>;
}

/** One record as a card, matching AdminTable's surface treatment. */
export function AdminCard({ children }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-card">{children}</div>
  );
}
