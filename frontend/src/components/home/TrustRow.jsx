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
 * Compact trust strip directly under the hero. The three cells share one
 * panel with 1px hairlines between them (a `gap-px` grid over a tinted
 * background, each cell opaque white) rather than three separate shadowed
 * cards — visually quieter than the hero above it, as a reassurance strip
 * should be.
 */
export function TrustRow() {
  return (
    <Reveal
      variant="up"
      className="mt-6 grid gap-px overflow-hidden rounded-panel border border-slate-200 bg-slate-200 shadow-card sm:grid-cols-3"
    >
      {HIGHLIGHTS.map((item) => (
        <div
          key={item.title}
          className="group flex items-start gap-3 bg-white p-5 transition-colors duration-200 hover:bg-brand-50/40"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-50 text-brand-700 transition-colors duration-200 group-hover:bg-brand-600 group-hover:text-white"
            aria-hidden="true"
          >
            <Icon name={item.icon} size="md" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{item.body}</p>
          </div>
        </div>
      ))}
    </Reveal>
  );
}
