import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { SectionRenderer } from "@/components/storefront/sections";
import { TemplateProps } from "./types";

export function BoutiqueTemplate({ store, products, drops, slug, sections }: TemplateProps) {
  if (sections && sections.length > 0) {
    return (
      <div>
        {sections
          .filter(s => s.enabled)
          .sort((a, b) => a.order - b.order)
          .map(section => (
            <SectionRenderer
              key={section.id || `${section.type}-${section.order}`}
              section={section}
              store={store}
              products={products}
              drops={drops}
              slug={slug}
            />
          ))}
      </div>
    );
  }
  const heroImage = products[0]?.images?.[0]?.url;

  return (
    <div>
      <section className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              {store.logo_url && (
                <img src={store.logo_url} alt="" className="h-10 object-contain mb-8" referrerPolicy="no-referrer" />
              )}
              <h1
                className="text-4xl sm:text-5xl font-bold mb-6 leading-tight"
                style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
              >
                {store.name}
              </h1>
              {store.description && (
                <p className="text-lg mb-8 leading-relaxed" style={{ color: "var(--color-text)", opacity: 0.6 }}>
                  {store.description}
                </p>
              )}
              <Link
                href={`/store/${slug}/catalog`}
                className="inline-flex items-center gap-2 px-8 py-3.5 font-medium text-sm transition hover:opacity-90"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-fg)",
                  borderRadius: "var(--radius-button)",
                }}
              >
                Descubrir colección <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {heroImage && (
              <div
                className="aspect-[3/4] overflow-hidden"
                style={{ borderRadius: "calc(var(--radius-card) * 1.5)" }}
              >
                <img src={heroImage} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      </section>

      {products.length > 0 && (
        <section className="py-16 sm:py-24" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2
                className="text-3xl font-bold mb-2"
                style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
              >
                Nuestros productos
              </h2>
              <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.5 }}>
                Seleccionados con cuidado para vos
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {products.slice(0, 6).map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  slug={p.slug}
                  price={p.price}
                  compare_at_price={p.compare_at_price}
                  images={p.images}
                  storeSlug={slug}
                />
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href={`/store/${slug}/catalog`}
                className="inline-flex items-center gap-2 text-sm font-medium transition"
                style={{ color: "var(--color-primary)" }}
              >
                Ver toda la colección <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2
                className="text-3xl font-bold mb-2"
                style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
              >
                Próximamente
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {drops.map((d) => (
                <div
                  key={d.id}
                  className="overflow-hidden transition hover:shadow-md"
                  style={{
                    borderRadius: "calc(var(--radius-card) * 1.5)",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-background)",
                  }}
                >
                  {d.image_url && (
                    <img src={d.image_url} alt={d.name} className="w-full h-52 object-cover" />
                  )}
                  <div className="p-6">
                    <h3
                      className="font-semibold text-lg mb-2"
                      style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
                    >
                      {d.name}
                    </h3>
                    {d.description && (
                      <p className="text-sm mb-3" style={{ color: "var(--color-text)", opacity: 0.5 }}>
                        {d.description}
                      </p>
                    )}
                    {d.drop_date && (
                      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(d.drop_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
