import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";

interface FeaturedProductsSectionProps {
  products: any[];
  config: {
    columns?: number;
    count?: number;
    show_price?: boolean;
  };
  slug: string;
}

export function FeaturedProductsSection({ products, config, slug }: FeaturedProductsSectionProps) {
  const count = config.count || 4;
  const columns = config.columns || 4;
  const visibleProducts = products.slice(0, count);

  if (visibleProducts.length === 0) return null;

  const gridClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between mb-10">
          <h2
            className="text-2xl md:text-3xl font-bold"
            style={{ color: "var(--color-text)" }}
          >
            Productos destacados
          </h2>
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--color-primary)" }}
          >
            Ver todo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className={`grid ${gridClass} gap-6`}>
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              compare_at_price={product.compare_at_price}
              images={product.images}
              storeSlug={slug}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
