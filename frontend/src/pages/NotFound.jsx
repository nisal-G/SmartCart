import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ROUTES } from '../constants/routes';

export function NotFound() {
  return (
    <PageWrapper className="flex items-center">
      <div className="relative isolate mx-auto flex max-w-lg flex-col items-center gap-6 overflow-hidden py-16 text-center sm:py-24">
        {/* One soft brand wash behind the numerals. Decoration only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/4 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl"
        />

        <span
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200/70"
          aria-hidden="true"
        >
          <Icon name="search" size="xl" strokeWidth={1.5} />
        </span>

        <p className="relative bg-linear-to-br from-slate-900 to-slate-500 bg-clip-text text-7xl font-extrabold tracking-tight text-transparent sm:text-8xl">
          404
        </p>

        <div className="relative space-y-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            This page doesn&apos;t exist
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-slate-600">
            The page you&apos;re looking for may have been moved, or the link is incorrect.
          </p>
        </div>

        <div className="relative flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link to={ROUTES.HOME} className="sm:w-auto">
            <Button variant="outline" fullWidth className="sm:w-auto">
              Back to home
            </Button>
          </Link>
          <Link to={ROUTES.PRODUCTS} className="sm:w-auto">
            <Button fullWidth className="sm:w-auto">
              Browse the catalogue
              <Icon name="arrowRight" size="sm" />
            </Button>
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
