import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Reveal } from '../motion/Reveal';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';

/**
 * Closing call-to-action band for the homepage. Session-aware: a signed-out
 * visitor is offered sign-in as the secondary step, a signed-in one their
 * order history — never a link that just bounces them to /login.
 *
 * The panel's decoration is CSS only (a gradient plus two blurred washes);
 * no image is loaded for it.
 */
export function ClosingCta() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="pt-16 sm:pt-24">
      <Reveal variant="up">
        <div className="relative isolate overflow-hidden rounded-panel bg-brand-900 px-6 py-14 shadow-panel sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-br from-brand-800 via-brand-900 to-slate-950"
          />
          <div
            aria-hidden="true"
            className="absolute -left-24 -top-24 h-72 w-72 animate-aurora rounded-full bg-brand-400/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -right-16 h-80 w-80 animate-aurora rounded-full bg-accent-400/15 blur-3xl"
          />

          <div className="relative flex flex-col items-center gap-8 text-center lg:flex-row lg:justify-between lg:text-left">
            <div className="max-w-xl">
              <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-200 lg:justify-start">
                <Icon name="sparkles" size="sm" />
                Ready when you are
              </p>
              <h2 className="mt-4 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Your next grocery run starts here
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-white/75">
                Browse the full catalogue, fill your cart and pay securely through PayHere — every
                order stays on record in your account.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link to={ROUTES.PRODUCTS} className="sm:w-auto">
                <Button size="lg" fullWidth className="shadow-float sm:w-auto">
                  Browse the catalogue
                  <Icon name="arrowRight" size="sm" />
                </Button>
              </Link>
              <Link to={isAuthenticated ? ROUTES.ORDERS : ROUTES.LOGIN} className="sm:w-auto">
                {/* Hand-styled rather than <Button variant="outline">, for the
                    same reason as the hero's second CTA: the outline variant
                    is a solid white pill built for light surfaces. Sized to
                    match <Button size="lg"> exactly. */}
                <span className="inline-flex h-13 w-full select-none items-center justify-center gap-2.5 rounded-control border border-white/40 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-md transition-[background-color,border-color,transform] duration-200 ease-standard hover:-translate-y-px hover:border-white/60 hover:bg-white/20 sm:w-auto">
                  {isAuthenticated ? 'View your orders' : 'Sign in'}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
