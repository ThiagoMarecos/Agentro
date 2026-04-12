import Link from "next/link";
import { ArrowRight, Calendar, Zap } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { SectionRenderer } from "@/components/storefront/sections";
import { TemplateProps } from "./types";

export function TechTemplate({ store, products, drops, slug, sections }: TemplateProps) {
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
      <section className="relative py-24 sm:py-36 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 50%, var(--color-accent) 100%)`,
            opacity: 0.15,
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[160px]"
          style={{ backgroundColor: "var(--color-primary)", opacity: 0.2 }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-8"
            style={{
              backgroundColor: "var(--color-surface)",
              color: "var(--color-primary)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Zap className="w-3.5 h-3.5" />
            {store.name}
          </div>
          <h1
            className="text-5xl sm:text-7xl font-bold tracking-tight mb-6"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
          >
            La tecnología
            <br />
            <span style={{ color: "var(--color-primary)" }}>que necesitás</span>
          </h1>
          {store.description && (
            <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: "var(--color-text)", opacity: 0.5 }}>
              {store.description}
            </p>
          )}
          <div className="flex items-center justify-center gap-4">
            <Link
              href={`/store/${slug}/catalog`}
              className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-sm transition hover:opacity-90"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-primary-fg)",
                borderRadius: "var(--radius-button)",
              }}
            >
              Explorar productos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {products.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-12">
              <div>
                <span
                  className="text-xs font-semibold uppercase tracking-wider mb-1 block"
                  style={{ color: "var(--color-primary)" }}
                >
                  Catálogo
                </span>
                <h2
                  className="text-3xl font-bold"
                  style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
                >
                  Productos destacados
                </h2>
              </div>
              <Link
                href={`/store/${slug}/catalog`}
                className="text-sm font-medium flex items-center gap-1 transition"
                style={{ color: "var(--color-primary)" }}
              >
                Ver todo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="py-16 sm:py-24" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <h2
              className="text-3xl font-bold mb-12"
              style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
            >
              Próximos lanzamientos
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {drops.map((d) => (
                <div
                  key={d.id}
                  className="overflow-hidden backdrop-blur-sm transition hover:scale-[1.02]"
                  style={{
                    borderRadius: "var(--radius-card)",
                    backgroundColor: "var(--color-background)",
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 0 30px -5px color-mix(in srgb, var(--color-primary) 15%, transparent)",
                  }}
                >
                  {d.image_url && (
                    <img src={d.image_url} alt={d.name} className="w-full h-48 object-cover" />
                  )}
                  <div className="p-5">
                    <h3
                      className="font-semibold mb-1"
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
