import { Container } from './Container';

/** Consistent page-level vertical rhythm/spacing so pages don't each invent their own. */
export function PageWrapper({ children }) {
  return (
    <main className="flex-1 py-8 sm:py-10">
      <Container>{children}</Container>
    </main>
  );
}
