import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ROUTES } from '../constants/routes';

export function NotFound() {
  return (
    <PageWrapper className="flex items-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center sm:py-24">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-8 ring-brand-50/50"
          aria-hidden="true"
        >
          <Icon name="search" size="xl" strokeWidth={1.5} />
        </span>
        <p className="text-5xl font-extrabold tracking-tight text-slate-900">404</p>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">This page doesn&apos;t exist</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            The page you&apos;re looking for may have been moved, or the link is incorrect.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to={ROUTES.HOME}>
            <Button variant="outline">Back to home</Button>
          </Link>
          <Link to={ROUTES.PRODUCTS}>
            <Button>
              Browse the catalogue
              <Icon name="arrowRight" size="sm" />
            </Button>
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
