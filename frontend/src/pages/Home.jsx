import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Icon } from '../components/ui/Icon';
import { SectionHeading } from '../components/ui/SectionHeading';
import { HeroSection } from '../components/home/HeroSection';
import { TrustRow } from '../components/home/TrustRow';
import { CategoryShowcase } from '../components/home/CategoryShowcase';
import { HowItWorks } from '../components/home/HowItWorks';
import { ClosingCta } from '../components/home/ClosingCta';
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
    <PageWrapper className="pt-4 sm:pt-6">
      <HeroSection showCategoriesCta={categories.length > 0} />
      <TrustRow />

      <CategoryShowcase categories={categories} />

      {(loadingFeatured || featuredProducts.length > 0) && (
        <section className="pt-16 sm:pt-24">
          <Reveal variant="up">
            <SectionHeading
              eyebrow="Just in"
              title="Recently added"
              description="The newest items in the catalogue, straight from the shelf."
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

          <div className="mt-8">
            {loadingFeatured ? (
              <ProductGridSkeleton count={FEATURED_LIMIT} />
            ) : (
              <ProductGrid products={featuredProducts} />
            )}
          </div>
        </section>
      )}

      <HowItWorks />
      <ClosingCta />
    </PageWrapper>
  );
}
