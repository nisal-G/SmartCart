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
    <section className="relative isolate flex min-h-125 items-center overflow-hidden rounded-panel bg-slate-900 sm:min-h-140 lg:min-h-160">
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

      {/* Overlay, in three layers: a left-to-right navy scrim so the text
          column sits on a readable near-opaque ground while the right side
          of the clip stays visible; a brand-green wash from the bottom so
          the panel reads as SmartCart's, not a stock clip; and a soft
          vignette so the frame edges settle rather than cutting hard. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-slate-950/85 via-slate-950/55 to-slate-950/15"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-brand-950/45 via-transparent to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 [background:radial-gradient(120%_100%_at_100%_0%,transparent_35%,rgb(2_6_23/0.35)_100%)]"
      />

      <div className="relative z-10 w-full px-6 py-14 sm:px-10 sm:py-16 lg:px-16">
        <div className="max-w-xl animate-hero-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md">
            <Icon name="store" size="sm" />
            Online grocery shopping
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Fresh groceries,
            <br />
            <span className="text-brand-300">one smart cart.</span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
            Browse vegetables, fruits, cakes and biscuits by category, add what you need to your
            cart, and check out in minutes.
          </p>

          <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
            <Link to={ROUTES.PRODUCTS}>
              <Button
                size="lg"
                fullWidth
                className="shadow-lg shadow-black/30 hover:-translate-y-0.5 sm:w-auto"
              >
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
                className="inline-flex h-12 select-none items-center justify-center gap-2 rounded-control border border-white/40 bg-white/10 px-6 text-base font-semibold text-white backdrop-blur-md transition-[background-color,border-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-0"
              >
                Browse categories
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
