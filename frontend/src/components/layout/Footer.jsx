/** Site footer. Intentionally minimal — no feature/business logic. */
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} SmartCart. All rights reserved.</p>
        <p>Built with React &amp; Vite.</p>
      </div>
    </footer>
  );
}
