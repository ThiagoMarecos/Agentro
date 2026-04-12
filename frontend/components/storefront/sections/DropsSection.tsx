import Link from "next/link";
import { Calendar, ImageIcon } from "lucide-react";

interface DropsSectionProps {
  drops: any[];
  slug: string;
}

export function DropsSection({ drops, slug }: DropsSectionProps) {
  if (drops.length === 0) return null;

  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <h2
          className="text-2xl md:text-3xl font-bold mb-10"
          style={{ color: "var(--color-text)" }}
        >
          Próximos drops
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {drops.map((drop) => (
            <Link
              key={drop.id}
              href={`/store/${slug}/drops`}
              className="group overflow-hidden transition-all duration-300 hover:-translate-y-1"
              style={{
                borderRadius: "var(--radius-card, 12px)",
                border: "var(--border-card, 1px solid rgba(0,0,0,0.08))",
                backgroundColor: "var(--color-background)",
                boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
              }}
            >
              <div
                className="aspect-video relative overflow-hidden"
                style={{ backgroundColor: "var(--color-surface)" }}
              >
                {drop.image_url ? (
                  <img
                    src={drop.image_url}
                    alt={drop.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center opacity-30"
                    style={{ color: "var(--color-text)" }}
                  >
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <h3
                  className="font-semibold text-lg mb-2 line-clamp-1"
                  style={{ color: "var(--color-text)" }}
                >
                  {drop.name}
                </h3>
                {drop.description && (
                  <p
                    className="text-sm mb-3 line-clamp-2"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {drop.description}
                  </p>
                )}
                {drop.drop_date && (
                  <div
                    className="flex items-center gap-1.5 text-xs font-medium"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(drop.drop_date).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
