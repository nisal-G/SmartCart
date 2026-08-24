/** Generic "nothing here yet" state — empty product lists, empty cart, no orders, etc. */
export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-slate-300 px-4 py-16 text-center">
      <p className="text-base font-medium text-slate-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
