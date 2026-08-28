import { Icon } from '../ui/Icon';
import { Reveal } from '../motion/Reveal';

// Factual, capability-based reassurance only — each line describes something
// the app actually does (see the cart/checkout/orders routes and the
// PayHere integration). No invented statistics, reviews or guarantees.
const HIGHLIGHTS = [
  {
    icon: 'tag',
    title: 'Everyday grocery range',
    body: 'Vegetables, fruits and bakery items, organised by category.',
  },
  {
    icon: 'shield',
    title: 'Secure PayHere checkout',
    body: 'Card details are handled by PayHere — never by SmartCart.',
  },
  {
    icon: 'receipt',
    title: 'Every order on record',
    body: 'Track status and payment for each order from your account.',
  },
];

/**
 * Trust strip that overlaps the bottom of the hero, so the two read as one
 * composed masthead rather than two stacked blocks. The three cells share
 * one panel with 1px hairlines between them (a `gap-px` grid over a tinted
 * background, each cell opaque white) rather than three separate shadowed
 * cards.
 *
 * The overlap is a negative margin inside the page container — never a
 * wider-than-container offset — so it can't introduce horizontal scroll on
 * narrow viewports.
 */
export function TrustRow() {
  return (
    <Reveal
      variant="up"
      className="relative z-10 mx-2 -mt-10 grid gap-px overflow-hidden rounded-panel border border-slate-200/80 bg-slate-200/80 shadow-lift sm:mx-8 sm:-mt-12 sm:grid-cols-3"
    >
      {HIGHLIGHTS.map((item) => (
        <div
          key={item.title}
          className="group flex items-start gap-3.5 bg-white p-5 transition-colors duration-200 hover:bg-brand-50/50 sm:p-6"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700 transition-[background-color,color,transform] duration-200 ease-standard group-hover:scale-105 group-hover:bg-brand-600 group-hover:text-white"
            aria-hidden="true"
          >
            <Icon name={item.icon} size="md" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{item.body}</p>
          </div>
        </div>
      ))}
    </Reveal>
  );
}
