import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";

interface ProductsBannerHybridProps {
  products: any[];
  config: {
    featured_products: {
      columns?: number;
      count?: number;
      show_price?: boolean;
    };
    banner: {
      title: string;
      subtitle?: string;
      bg_color?: string;
      text_color?: string;
      link?: string;
      alignment?: "left" | "center" | "right";
    };
  };
  slug: string;
}

export function ProductsBannerHybrid({ products, config, slug }: ProductsBannerHybridProps) {
  const prodConfig = config.featured_products ?? {};
  const bannerConfig = config.banner ?? { title: "" };

  const count = prodConfig.count || 8;
  const columns = prodConfig.columns || 4;
  const visibleProducts = products.slice(0, count);

  const gridClass =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  const alignClass =
    bannerConfig.alignment === "left"
      ? "text-left"
      : bannerConfig.alignment === "right"
        ? "text-right"
        : "text-center";

  const bannerBg = bannerConfig.bg_color || "var(--color-primary, #6366f1)";
  const bannerText = bannerConfig.text_color || "#ffffff";

  const bannerContent = (
    <div
      className={`w-full py-8 px-6 rounded-2xl ${alignClass}`}
      style={{ backgroundColor: bannerBg, color: bannerText }}
    >
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold">{bannerConfig.title}</h2>
        {bannerConfig.subtitle && (
          <p className="mt-2 text-lg opacity-90">{bannerConfig.subtitle}</p>
        )}
      </div>
    </div>
  );

  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-7xl mx-auto px-6">
        {bannerConfig.link ? (
          <a href={bannerConfig.link} className="block mb-10 hover:opacity-95 transition-opacity">
            {bannerContent}
          </a>
        ) : (
          <div className="mb-10">{bannerContent}</div>
        )}

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--color-text)" }}>
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
