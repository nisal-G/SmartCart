import { Container } from './Container';
import { classNames } from '../../utils/classNames';

/** Consistent page-level vertical rhythm/spacing so pages don't each invent their own. */
export function PageWrapper({ className, children }) {
  return (
    <main className={classNames('flex-1 pb-16 pt-6 sm:pt-8', className)}>
      <Container>{children}</Container>
    </main>
  );
}
