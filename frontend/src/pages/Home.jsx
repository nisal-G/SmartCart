import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';

export function Home() {
  return (
    <PageWrapper>
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Welcome to SmartCart
        </h1>
        <p className="max-w-xl text-slate-600">
          Browse products, build your cart, and check out securely. The full catalog and
          shopping experience are coming soon.
        </p>
        <Link to={ROUTES.PRODUCTS}>
          <Button>Browse products</Button>
        </Link>
      </div>
    </PageWrapper>
  );
}
