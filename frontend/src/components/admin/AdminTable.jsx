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
 *
 * The wrapper needs `overflow-x-auto` so a wide table can scroll
 * horizontally on narrower desktop/tablet widths without the whole page
 * doing so. Per the CSS overflow spec, setting only one axis to something
 * other than `visible` forces the *other* axis to compute as `auto` too
 * (browsers don't support one axis scrolling while the other stays
 * genuinely `visible`) — so this div is unavoidably its own scroll
 * container on both axes, not just the horizontal one it asks for. A
 * `sticky` thead therefore sticks to *this div's* scrollport, not the
 * window: `top-0` + a bounded `max-h` (so the div can actually scroll
 * vertically when a list runs long, e.g. AdminCategories' unpaginated
 * list) is the offset that's actually correct for that scroll container.
 * An earlier `sticky top-16` here (written assuming the window scrolls)
 * created a standing bug: the header would sit stuck ~64px below this
 * div's own top on *first paint*, with nothing having scrolled yet,
 * landing it on top of the first row hard enough to swallow that row's
 * own clicks (confirmed both in Playwright and by inspecting the actual
 * rendered geometry — see git history for the investigation).
 */
export function AdminTable({ head, children, className }) {
  return (
    <div
      className={classNames(
        'hidden max-h-[70vh] overflow-auto rounded-card border border-slate-200/80 bg-white shadow-card md:block',
        className
      )}
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-sunken text-xs font-bold uppercase tracking-wider text-slate-500">
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

/** Row with the shared hover treatment. `scroll-mt-12` clears the thead's
 * own ~44px height: without it, scrolling a row into view within the
 * table's scroll container (e.g. keyboard focus, or Playwright's
 * auto-scroll-before-click) can land the row's top edge flush with the
 * container's top, right where the `sticky top-0` header still sits,
 * which then intercepts the very click meant for the row. */
export function Tr({ className, children }) {
  return (
    <tr
      className={classNames('scroll-mt-12 transition-colors duration-150 hover:bg-slate-50/80', className)}
    >
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
    <div className="rounded-card border border-slate-200/80 bg-white p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover">{children}</div>
  );
}
