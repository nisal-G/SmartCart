import { Container } from './Container';
import { classNames } from '../../utils/classNames';

/** Consistent page-level vertical rhythm/spacing so pages don't each invent their own. */
export function PageWrapper({ className, children }) {
  return (
    <main className={classNames('flex-1 pb-20 pt-8 sm:pb-24 sm:pt-10', className)}>
      <Container>{children}</Container>
    </main>
  );
}
