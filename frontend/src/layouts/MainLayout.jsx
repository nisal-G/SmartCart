import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { PageTransition } from '../components/layout/PageTransition';
import { ROUTES } from '../constants/routes';

/** App shell shared by every route: header, routed page content, footer. */
export function MainLayout() {
  const location = useLocation();
  // Admin sub-navigation gets its own, narrower page transition (see
  // AdminLayout) that fades only its content pane — wrapping the outlet
  // here too would key on the same full pathname and force the admin
  // sidebar to remount on every admin page change.
  const isAdminArea = location.pathname.startsWith(ROUTES.ADMIN);

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      {/* Keyboard users land here first and can jump the whole header. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>
      <Navbar />
      <div id="main-content" className="flex flex-1 flex-col">
        {isAdminArea ? <Outlet /> : <PageTransition><Outlet /></PageTransition>}
      </div>
      <Footer />
    </div>
  );
}
