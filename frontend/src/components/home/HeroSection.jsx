import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { ROUTES } from '../../constants/routes';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

// The hero clip ships with the app (frontend/public/Hero_Video.mp4) — no CDN,
// no embed, no third-party player. 1280x720, ~10s, ~2.5MB, muted and looping.
const HERO_VIDEO_SRC = '/Hero_Video.mp4';

// Where to park the clip for viewers who asked for reduced motion: late
// enough that the cart is full, so the still frame tells the same story the
// moving one does.
const REDUCED_MOTION_FRAME_SECONDS = 9;

// Capability statements only — each one describes something the app
// actually does. No invented delivery times, ratings or customer counts.
const HERO_POINTS = [
  { icon: 'leaf', label: 'Fresh produce & bakery' },
  { icon: 'shield', label: 'Secure PayHere checkout' },
  { icon: 'receipt', label: 'Order tracking built in' },
];

/**
 * Homepage hero: the grocery clip fills the whole panel as a background —
 * covered by a fixed navy/brand gradient for contrast — with the message and
 * calls to action layered on top, left-aligned.
 *
 * The clip is decoration with a purpose — it shows the catalogue the copy
 * describes — but never carries meaning on its own: every word of the hero
 * message is real text (the `<video>` itself is `aria-hidden`), so the
 * section reads identically with the video blocked, paused or still
 * buffering.
 */
export function HeroSection({ showCategoriesCta = false }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    if (!prefersReducedMotion) {
      // `autoPlay` covers the normal case; this only recovers the browsers
      // that ignore the attribute when the element mounts during a
      // client-side navigation rather than on a fresh document.
      video.play().catch(() => {});
      return undefined;
    }

    // Reduced motion: hold a single frame instead of looping. The seek is
    // what makes that frame paint at all, since the element never plays.
    const holdStill = () => {
      video.pause();
      if (!Number.isFinite(video.duration)) return;
      const frame = Math.min(REDUCED_MOTION_FRAME_SECONDS, video.duration - 0.05);
      if (Math.abs(video.currentTime - frame) > 0.25) video.currentTime = frame;
    };

    holdStill();
    video.addEventListener('loadedmetadata', holdStill);
    video.addEventListener('play', holdStill);
    return () => {
      video.removeEventListener('loadedmetadata', holdStill);
      video.removeEventListener('play', holdStill);
    };
  }, [prefersReducedMotion]);

  return (
    // `flex` + `min-h-*` (a floor, not a fixed height) rather than a fixed
    // height: the video/overlays are `absolute inset-0` and so don't
    // contribute to this element's own size, but the content column below
    // is a normal flex child and *does* — so on a viewport too narrow for
    // the copy to fit inside the floor, the section grows to fit it instead
    // of clipping text, and the video simply stretches to match.
    <section className="relative isolate flex min-h-132 items-center overflow-hidden rounded-panel bg-slate-900 shadow-panel sm:min-h-150 lg:min-h-172">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        aria-hidden="true"
      >
        <source src={HERO_VIDEO_SRC} type="video/mp4" />
      </video>

      {/* Overlay, in four layers: a left-to-right navy scrim so the text
          column sits on a readable near-opaque ground while the right side
          of the clip stays visible; a brand-green wash from the bottom so
          the panel reads as SmartCart's, not a stock clip; a soft vignette
          so the frame edges settle rather than cutting hard; and a very
          faint grain-free highlight at the top-left where the badge sits. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-slate-950/88 via-slate-950/60 to-slate-950/20"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-brand-950/55 via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 [background:radial-gradient(120%_100%_at_100%_0%,transparent_35%,rgb(2_6_23/0.4)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-32 h-96 w-96 animate-aurora rounded-full bg-brand-500/20 blur-3xl"
      />

      <div className="relative z-10 w-full px-6 py-16 sm:px-10 sm:py-20 lg:px-16 lg:py-24">
        <div className="max-w-2xl">
          <span
            className="inline-flex animate-hero-rise items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md"
            style={{ animationDelay: '40ms' }}
          >
            <Icon name="store" size="sm" />
            Online grocery shopping
          </span>

          <h1
            className="mt-6 animate-hero-rise text-balance text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '120ms' }}
          >
            Fresh groceries,
            <br />
            <span className="bg-linear-to-r from-brand-300 via-brand-200 to-accent-200 bg-clip-text text-transparent">
              one smart cart.
            </span>
          </h1>

          <p
            className="mt-6 max-w-lg animate-hero-rise text-pretty text-base leading-relaxed text-white/85 sm:text-lg"
            style={{ animationDelay: '200ms' }}
          >
            Browse vegetables, fruits, cakes and biscuits by category, add what you need to your
            cart, and check out in minutes.
          </p>

          <div
            className="mt-9 flex animate-hero-rise flex-col flex-wrap gap-3 sm:flex-row"
            style={{ animationDelay: '280ms' }}
          >
            <Link to={ROUTES.PRODUCTS} className="sm:w-auto">
              <Button size="lg" fullWidth className="shadow-float sm:w-auto">
                Start shopping
                <Icon name="arrowRight" size="sm" />
              </Button>
            </Link>
            {showCategoriesCta && (
              // A hand-styled control rather than <Button variant="outline">:
              // that variant is a solid white pill (right for the app's
              // light surfaces), and layering its `bg-white`/`border-slate-*`
              // utilities under a glass look here would leave two `bg-*`
              // classes competing on specificity/source order rather than
              // JSX order — see the warning in Button.jsx. Sized to match
              // <Button size="lg"> exactly so the pair still lines up.
              <a
                href="#shop-by-category"
                className="inline-flex h-13 select-none items-center justify-center gap-2.5 rounded-control border border-white/40 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur-md transition-[background-color,border-color,transform] duration-200 ease-standard hover:-translate-y-px hover:border-white/60 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-px"
              >
                Browse categories
              </a>
            )}
          </div>

          <ul
            className="mt-10 flex animate-hero-rise flex-wrap gap-x-6 gap-y-3"
            style={{ animationDelay: '360ms' }}
          >
            {HERO_POINTS.map((point) => (
              <li key={point.label} className="flex items-center gap-2 text-sm text-white/80">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-brand-200 backdrop-blur-md"
                  aria-hidden="true"
                >
                  <Icon name={point.icon} size="sm" />
                </span>
                {point.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
