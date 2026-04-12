import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { SectionRenderer } from "@/components/storefront/sections";
import { TemplateProps } from "./types";

export function StreetTemplate({ store, products, drops, slug, sections }: TemplateProps) {
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
      <section
        className="relative py-24 sm:py-36 overflow-hidden"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.05) 20px, rgba(255,255,255,0.05) 40px)",
          }}
        />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          {store.logo_url && (
            <img src={store.logo_url} alt="" className="h-16 object-contain mb-8 drop-shadow-lg" referrerPolicy="no-referrer" />
          )}
          <h1
            className="text-5xl sm:text-7xl font-black uppercase tracking-tight mb-4 drop-shadow-lg"
            style={{ color: "#fff", fontFamily: "var(--font-heading)" }}
          >
            {store.name}
          </h1>
          {store.description && (
            <p className="text-xl mb-10 max-w-xl" style={{ color: "rgba(255,255,255,0.8)" }}>
              {store.description}
            </p>
          )}
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-3 px-8 py-4 font-bold text-sm uppercase tracking-wider transition hover:scale-105"
            style={{
              backgroundColor: "var(--color-primary-fg)",
              color: "var(--color-primary)",
              borderRadius: "var(--radius-button)",
            }}
          >
            Explorar <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {products.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-12">
              <div>
                <span
                  className="text-xs font-bold uppercase tracking-[0.2em] mb-2 block"
                  style={{ color: "var(--color-primary)" }}
                >
                  Lo más nuevo
                </span>
                <h2
                  className="text-3xl sm:text-4xl font-black uppercase"
                  style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
                >
                  Productos
                </h2>
              </div>
              <Link
                href={`/store/${slug}/catalog`}
                className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition"
                style={{ color: "var(--color-primary)" }}
              >
                Ver todo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
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
              className="text-3xl font-black uppercase mb-12"
              style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
            >
              Próximos Drops
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {drops.map((d) => (
                <div
                  key={d.id}
                  className="overflow-hidden transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    borderRadius: "var(--radius-card)",
                    backgroundColor: "var(--color-background)",
                    border: "2px solid var(--color-border)",
                  }}
                >
                  {d.image_url && (
                    <img src={d.image_url} alt={d.name} className="w-full h-56 object-cover" />
                  )}
                  <div className="p-6">
                    <h3
                      className="font-bold text-lg uppercase mb-2"
                      style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
                    >
                      {d.name}
                    </h3>
                    {d.description && (
                      <p className="text-sm mb-3" style={{ color: "var(--color-text)", opacity: 0.6 }}>
                        {d.description}
                      </p>
                    )}
                    {d.drop_date && (
                      <div
                        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                        style={{ color: "var(--color-primary)" }}
                      >
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
