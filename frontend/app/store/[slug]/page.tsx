"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getStore, getProducts, getDrops } from "@/lib/api/storefront";
import { TemplateRouter } from "@/components/storefront/templates/TemplateRouter";
import { Store } from "lucide-react";

interface StoreData {
  name: string;
  description?: string;
  logo_url?: string | null;
  theme?: {
    template_name: string;
    custom_config: any;
  };
}

export default function StorefrontHomePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [store, setStore] = useState<StoreData | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [drops, setDrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      getStore(slug).then(setStore).catch(() => setStore(null)),
      getProducts(slug).then(setProducts).catch(() => setProducts([])),
      getDrops(slug).then(setDrops).catch(() => setDrops([])),
    ]).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded-lg" style={{ backgroundColor: "var(--color-border)" }} />
          <div className="h-4 w-96 rounded" style={{ backgroundColor: "var(--color-border)" }} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl" style={{ backgroundColor: "var(--color-border)" }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Store className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--color-border)" }} />
        <h1 className="text-2xl font-display font-bold mb-2" style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}>
          Tienda no encontrada
        </h1>
        <p className="mb-6" style={{ color: "var(--color-text)", opacity: 0.5 }}>
          Esta tienda no existe o no está disponible.
        </p>
        <Link href="/" className="font-medium text-sm" style={{ color: "var(--color-primary)" }}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  const templateName = store.theme?.template_name || "streetwear";

  return (
    <TemplateRouter
      templateName={templateName}
      store={store}
      products={products}
      drops={drops}
      slug={slug}
      sections={store.theme?.custom_config?.sections}
    />
  );
}
