import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';

export function NotFound() {
  return (
    <PageWrapper>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-4xl font-semibold text-slate-900">404</h1>
        <p className="text-slate-600">The page you're looking for doesn't exist.</p>
        <Link to={ROUTES.HOME}>
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    </PageWrapper>
  );
}
