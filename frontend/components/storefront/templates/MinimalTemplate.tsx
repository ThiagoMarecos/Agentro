import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { SectionRenderer } from "@/components/storefront/sections";
import { TemplateProps } from "./types";

export function MinimalTemplate({ store, products, drops, slug, sections }: TemplateProps) {
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

  return (
    <div>
      <section className="py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1
            className="text-4xl sm:text-6xl font-light tracking-tight mb-6"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
          >
            {store.name}
          </h1>
          {store.description && (
            <p className="text-lg mb-10 max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--color-text)", opacity: 0.5 }}>
              {store.description}
            </p>
          )}
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-8 py-3 text-sm font-medium tracking-wide uppercase transition border"
            style={{
              color: "var(--color-text)",
              borderColor: "var(--color-text)",
              borderRadius: "var(--radius-button)",
            }}
          >
            Ver catálogo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {products.length > 0 && (
        <section className="pb-24 sm:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div
              className="mb-16 pb-4"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <h2
                  className="text-sm font-medium uppercase tracking-[0.15em]"
                  style={{ color: "var(--color-text)", opacity: 0.5 }}
                >
                  Productos
                </h2>
                <Link
                  href={`/store/${slug}/catalog`}
                  className="text-sm flex items-center gap-1 transition"
                  style={{ color: "var(--color-text)", opacity: 0.5 }}
                >
                  Ver todo <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-8">
              {products.slice(0, 8).map((p) => (
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
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="pb-24 sm:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div
              className="mb-16 pb-4"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2
                className="text-sm font-medium uppercase tracking-[0.15em]"
                style={{ color: "var(--color-text)", opacity: 0.5 }}
              >
                Próximos drops
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {drops.map((d) => (
                <div key={d.id} className="group">
                  {d.image_url && (
                    <div className="mb-4 overflow-hidden" style={{ borderRadius: "var(--radius-card)" }}>
                      <img src={d.image_url} alt={d.name} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <h3
                    className="font-medium mb-1"
                    style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
                  >
                    {d.name}
                  </h3>
                  {d.description && (
                    <p className="text-sm mb-2" style={{ color: "var(--color-text)", opacity: 0.4 }}>
                      {d.description}
                    </p>
                  )}
                  {d.drop_date && (
                    <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.3 }}>
                      {new Date(d.drop_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
