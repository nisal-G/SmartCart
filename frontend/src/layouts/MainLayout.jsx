import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';

/** App shell shared by every route: header, routed page content, footer. */
export function MainLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
