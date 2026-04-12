"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getProducts } from "@/lib/api/storefront";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { Package } from "lucide-react";

export default function CatalogPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [products, setProducts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getProducts(slug).then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-sm mb-6 text-gray-400">
          <Link href={`/store/${slug}`} className="transition hover:text-gray-700" style={{ color: "var(--color-primary)" }}>Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">Catálogo</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>Catálogo</h1>
        <p className="text-gray-500 mb-10">Explorá todos nuestros productos.</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl animate-pulse bg-gray-100" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <ProductGrid products={products as never[]} storeSlug={slug} />
        ) : (
          <div className="text-center py-20">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>No hay productos todavía</h3>
            <p className="text-sm text-gray-500 mb-6">El catálogo se está preparando. Volvé pronto.</p>
            <Link href={`/store/${slug}`} className="font-medium text-sm" style={{ color: "var(--color-primary)" }}>Volver al inicio</Link>
          </div>
        )}
      </div>
    </div>
  );
}
