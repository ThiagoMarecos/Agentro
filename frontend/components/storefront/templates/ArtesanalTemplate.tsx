import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { ProductCard } from "../ProductCard";
import { SectionRenderer } from "@/components/storefront/sections";
import { TemplateProps } from "./types";

export function ArtesanalTemplate({ store, products, drops, slug, sections }: TemplateProps) {
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
      <section className="py-20 sm:py-32 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          {store.logo_url && (
            <img src={store.logo_url} alt="" className="h-14 object-contain mx-auto mb-8" referrerPolicy="no-referrer" />
          )}
          <div
            className="w-16 h-[2px] mx-auto mb-8"
            style={{ backgroundColor: "var(--color-primary)" }}
          />
          <h1
            className="text-4xl sm:text-5xl font-bold mb-6 leading-tight"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
          >
            {store.name}
          </h1>
          {store.description && (
            <p
              className="text-lg mb-10 max-w-xl mx-auto leading-relaxed italic"
              style={{ color: "var(--color-text)", opacity: 0.6, fontFamily: "var(--font-heading)" }}
            >
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
            Explorar productos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {products.length > 0 && (
        <section className="py-16 sm:py-24" style={{ backgroundColor: "var(--color-surface)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <div
                className="w-12 h-[2px] mx-auto mb-6"
                style={{ backgroundColor: "var(--color-primary)" }}
              />
              <h2
                className="text-3xl font-bold"
                style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
              >
                Hecho con dedicación
              </h2>
              <p className="text-sm mt-2" style={{ color: "var(--color-text)", opacity: 0.5 }}>
                Cada pieza cuenta una historia
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
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
                Ver todo el catálogo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <div
                className="w-12 h-[2px] mx-auto mb-6"
                style={{ backgroundColor: "var(--color-primary)" }}
              />
              <h2
                className="text-3xl font-bold"
                style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
              >
                Próximas creaciones
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {drops.map((d) => (
                <div
                  key={d.id}
                  className="overflow-hidden transition hover:shadow-md"
                  style={{
                    borderRadius: "calc(var(--radius-card) + 4px)",
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
                      <p
                        className="text-sm mb-3 italic"
                        style={{ color: "var(--color-text)", opacity: 0.5 }}
                      >
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
