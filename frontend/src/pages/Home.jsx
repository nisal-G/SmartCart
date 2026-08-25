import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/ui/PageWrapper';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/common/Loading';
import { ProductGrid } from '../components/common/ProductGrid';
import productService from '../services/productService';
import categoryService from '../services/categoryService';
import { ROUTES } from '../constants/routes';

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
      .getProducts({ limit: 4 })
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
      <section className="flex flex-col items-center gap-4 py-8 text-center sm:py-12">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Welcome to SmartCart
        </h1>
        <p className="max-w-xl text-slate-600">
          Fresh vegetables, fruits, cakes, and biscuits — browse the catalog and build your cart
          in minutes.
        </p>
        <Link to={ROUTES.PRODUCTS}>
          <Button size="lg">Browse products</Button>
        </Link>
      </section>

      {categories.length > 0 && (
        <section className="py-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Shop by category</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category._id}
                to={`${ROUTES.PRODUCTS}?category=${category._id}`}
                className="group flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-slate-400">
                      {category.name.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(loadingFeatured || featuredProducts.length > 0) && (
        <section className="py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Recently added</h2>
            <Link
              to={ROUTES.PRODUCTS}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View all
            </Link>
          </div>
          {loadingFeatured ? (
            <Loading label="Loading products…" />
          ) : (
            <ProductGrid products={featuredProducts} />
          )}
        </section>
      )}
    </PageWrapper>
  );
}
