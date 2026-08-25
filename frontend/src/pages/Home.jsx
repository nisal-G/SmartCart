import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Icon } from '../components/ui/Icon';
import { HeroSection } from '../components/home/HeroSection';
import { TrustRow } from '../components/home/TrustRow';
import { Reveal } from '../components/motion/Reveal';
import { ProductGrid } from '../components/common/ProductGrid';
import { ProductGridSkeleton } from '../components/common/skeletons';
import productService from '../services/productService';
import categoryService from '../services/categoryService';
import { ROUTES } from '../constants/routes';

const FEATURED_LIMIT = 8;

/** Shopping homepage: intro, category browsing entry points, and a small recent-products preview. */
export function Home() {
  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // Both sections are non-critical to the page — a failure here just means
  // that section doesn't render, never a page-level error state.
  useEffect(() => {
    let ignore = false;
    categoryService
      .getCategories()
      .then((data) => {
        if (!ignore) setCategories(data);
      })
      .catch(() => {});
    productService
      .getProducts({ limit: FEATURED_LIMIT })
      .then((data) => {
        if (!ignore) setFeaturedProducts(data.products);
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoadingFeatured(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <PageWrapper>
      <HeroSection showCategoriesCta={categories.length > 0} />
      <TrustRow />

      {categories.length > 0 && (
        <section id="shop-by-category" className="scroll-mt-28 pt-12 sm:pt-16">
          <Reveal variant="up" className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Shop by category
              </h2>
              <p className="mt-1 text-sm text-slate-500">Jump straight to what you need.</p>
            </div>
            <Link
              to={ROUTES.PRODUCTS}
              className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 sm:inline-flex"
            >
              View all
              <Icon name="chevronRight" size="sm" />
            </Link>
          </Reveal>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] lg:gap-4">
            {categories.map((category, index) => (
              <Reveal key={category._id} delay={Math.min(index, 8) * 60} className="h-full">
                <Link
                  to={`${ROUTES.PRODUCTS}?category=${category._id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-[box-shadow,transform,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-50">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-2xl font-bold text-brand-300"
                        aria-hidden="true"
                      >
                        {category.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {category.name}
                      </p>
                      {category.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:bg-brand-600 group-hover:text-white"
                      aria-hidden="true"
                    >
                      <Icon name="chevronRight" size="sm" strokeWidth={2} />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {(loadingFeatured || featuredProducts.length > 0) && (
        <section className="pt-12 sm:pt-16">
          <Reveal variant="up" className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Recently added
              </h2>
              <p className="mt-1 text-sm text-slate-500">The newest items in the catalogue.</p>
            </div>
            <Link
              to={ROUTES.PRODUCTS}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
            >
              View all
              <Icon name="chevronRight" size="sm" />
            </Link>
          </Reveal>

          {loadingFeatured ? (
            <ProductGridSkeleton count={FEATURED_LIMIT} />
          ) : (
            <ProductGrid products={featuredProducts} />
          )}
        </section>
      )}
    </PageWrapper>
  );
}
