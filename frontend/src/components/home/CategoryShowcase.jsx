import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Reveal } from '../motion/Reveal';
import { SectionHeading } from '../ui/SectionHeading';
import { ROUTES } from '../../constants/routes';
import { classNames } from '../../utils/classNames';

/*
 * The first tile spans two columns/rows, which gives the section an
 * editorial rhythm instead of a flat grid of identical squares. Purely
 * presentational — no category is treated as more important in the data.
 *
 * Both the span and the column count are conditional on how many categories
 * there actually are: a feature tile beside a single small one (a store
 * with two categories) reads as a broken layout, not a considered one, so
 * below four categories the tiles stay uniform and the grid narrows to fit
 * them.
 */
const FEATURE_TILE_MIN_CATEGORIES = 4;

function gridColumnsClass(count) {
  if (count < FEATURE_TILE_MIN_CATEGORIES) {
    // Phones stay two-up either way — a single full-width tile per row
    // wastes the screen; it's only the wider breakpoints that need to stop
    // stretching two or three tiles across four columns.
    return count <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
  }
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
}

/**
 * "Shop by category" on the homepage. Each tile links straight into the
 * catalogue pre-filtered to that category (`/products?category=<id>`) — the
 * same URL the header's category strip uses, so filtering has exactly one
 * implementation.
 */
export function CategoryShowcase({ categories }) {
  if (!categories.length) return null;

  const featured = categories.length >= FEATURE_TILE_MIN_CATEGORIES;

  return (
    <section id="shop-by-category" className="scroll-mt-32 pt-16 sm:pt-24">
      <Reveal variant="up">
        <SectionHeading
          eyebrow="Browse the aisles"
          title="Shop by category"
          description="Jump straight to the shelf you need — every category links into the full catalogue."
          action={
            <Link
              to={ROUTES.PRODUCTS}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition-[border-color,background-color,transform] duration-200 ease-standard hover:-translate-y-px hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            >
              View all
              <Icon name="arrowRight" size="sm" />
            </Link>
          }
        />
      </Reveal>

      <div
        className={classNames(
          'mt-8 grid auto-rows-44 gap-4 sm:auto-rows-42 lg:gap-5',
          gridColumnsClass(categories.length)
        )}
      >
        {categories.map((category, index) => (
          <Reveal
            key={category._id}
            delay={Math.min(index, 8) * 60}
            className={classNames('h-full', index === 0 && featured && 'sm:col-span-2 sm:row-span-2')}
          >
            <Link
              to={`${ROUTES.PRODUCTS}?category=${category._id}`}
              className="group relative flex h-full flex-col justify-end overflow-hidden rounded-card border border-slate-200/80 bg-slate-900 shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-entrance hover:-translate-y-1.5 hover:border-brand-300 hover:shadow-lift"
            >
              {category.image ? (
                <img
                  src={category.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-entrance group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-brand-700 to-brand-900 text-5xl font-extrabold text-white/25"
                  aria-hidden="true"
                >
                  {category.name.charAt(0)}
                </div>
              )}

              {/* Scrim: deep enough at the bottom for white text to clear
                  contrast over any photograph, transparent at the top so
                  the image still reads. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-slate-950/85 via-slate-950/35 to-transparent transition-opacity duration-300 group-hover:from-slate-950/90"
              />

              <div className="relative flex items-end justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p
                    className={classNames(
                      'truncate font-bold text-white',
                      index === 0 && featured ? 'text-lg sm:text-2xl' : 'text-sm sm:text-base'
                    )}
                  >
                    {category.name}
                  </p>
                  {category.description && (
                    <p
                      className={classNames(
                        'mt-1 text-xs leading-relaxed text-white/70',
                        index === 0 && featured ? 'line-clamp-2 sm:text-sm' : 'line-clamp-1'
                      )}
                    >
                      {category.description}
                    </p>
                  )}
                </div>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-md transition-[background-color,transform] duration-300 ease-entrance group-hover:translate-x-0.5 group-hover:bg-brand-600"
                  aria-hidden="true"
                >
                  <Icon name="arrowRight" size="sm" strokeWidth={2} />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
