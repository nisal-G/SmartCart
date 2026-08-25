import { useInView } from '../../hooks/useInView';
import { classNames } from '../../utils/classNames';

// Each variant is just its *hidden* state — the visible state is always
// opacity-100 + no transform, so every variant ends at the same place.
const HIDDEN_CLASSES = {
  up: 'opacity-0 translate-y-4',
  fade: 'opacity-0',
  scale: 'opacity-0 scale-95',
};

/**
 * One reusable scroll-reveal wrapper: content fades (and optionally
 * slides/scales) into place the first time it enters the viewport, via
 * `useInView`. Plain Tailwind transition utilities rather than a keyframe
 * animation — GPU-only properties (`opacity`/`transform`), and it means the
 * existing global `prefers-reduced-motion` rule in index.css (which zeroes
 * every transition-duration) neutralises this automatically, same as every
 * hover/focus transition elsewhere in the app.
 *
 * `delay` (ms) staggers items in a grid/list — pass `index * 60` or similar
 * from a `.map()` rather than writing a bespoke stagger each place one is
 * needed.
 */
export function Reveal({ children, as: As = 'div', variant = 'up', delay = 0, className }) {
  const [ref, inView] = useInView();

  return (
    <As
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={classNames(
        'transition-[opacity,transform] duration-500 ease-out',
        inView ? 'translate-y-0 scale-100 opacity-100' : HIDDEN_CLASSES[variant] || HIDDEN_CLASSES.up,
        className
      )}
    >
      {children}
    </As>
  );
}
