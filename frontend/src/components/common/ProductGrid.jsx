import { ProductCard } from './ProductCard';
import { Reveal } from '../motion/Reveal';

// Every card past this index reveals with the same delay as this one
// instead of a linearly increasing one — a 40-item page shouldn't take
// several seconds to finish animating in.
const MAX_STAGGERED = 8;
const STAGGER_STEP_MS = 60;

/**
 * Responsive product grid — 2 columns on phones, 3 on tablets, 4 from
 * `lg` up. Callers own loading/error/empty states; this only renders items.
 *
 * Each card fades/lifts into place the first time the grid scrolls into
 * view, staggered slightly card-by-card — one shared `Reveal` (see
 * components/motion), not a bespoke animation here, so this is the same
 * effect used for every other grid/list in the app.
 */
export function ProductGrid({ products }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {products.map((product, index) => (
        <Reveal key={product._id} delay={Math.min(index, MAX_STAGGERED) * STAGGER_STEP_MS} className="h-full">
          <ProductCard product={product} />
        </Reveal>
      ))}
    </div>
  );
}
