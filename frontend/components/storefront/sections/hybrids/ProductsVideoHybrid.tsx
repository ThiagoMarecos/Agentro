"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { VideoHybridLayout } from "./VideoHybridLayout";

interface ProductsVideoHybridProps {
  products: any[];
  config: {
    layout?: string;
    featured_products: {
      columns?: number;
      count?: number;
      show_price?: boolean;
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
  slug: string;
}

export function ProductsVideoHybrid({ products, config, slug }: ProductsVideoHybridProps) {
  const prodConfig = config.featured_products ?? {};
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "right";

  const count = prodConfig.count || 4;
  const visibleProducts = products.slice(0, count);
  const bgMode = layout === "background";

  const gridCols = bgMode ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2";

  return (
    <VideoHybridLayout layout={layout} videoConfig={videoConfig}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-2xl md:text-3xl font-bold"
            style={{ color: bgMode ? "inherit" : "var(--color-text)" }}
          >
            Productos destacados
          </h2>
          {!bgMode && (
            <Link
              href={`/store/${slug}/catalog`}
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--color-primary)" }}
            >
              Ver todo
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
        <div className={`grid ${gridCols} gap-5`}>
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
    </VideoHybridLayout>
  );
}
