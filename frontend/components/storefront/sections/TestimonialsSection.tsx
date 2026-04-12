import { Quote } from "lucide-react";

interface TestimonialsSectionProps {
  config: {
    items: Array<{
      name: string;
      text: string;
      avatar?: string;
    }>;
  };
}

export function TestimonialsSection({ config }: TestimonialsSectionProps) {
  const items = config.items || [];
  if (items.length === 0) return null;

  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <h2
          className="text-2xl md:text-3xl font-bold mb-10 text-center"
          style={{ color: "var(--color-text)" }}
        >
          Lo que dicen nuestros clientes
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, index) => (
            <div
              key={index}
              className="p-6 flex flex-col"
              style={{
                borderRadius: "var(--radius-card, 12px)",
                border: "var(--border-card, 1px solid rgba(0,0,0,0.08))",
                backgroundColor: "var(--color-surface)",
                boxShadow: "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
              }}
            >
              <Quote
                className="w-6 h-6 mb-4 opacity-30"
                style={{ color: "var(--color-primary)" }}
              />
              <p
                className="text-sm leading-relaxed flex-1 mb-6"
                style={{ color: "var(--color-text)" }}
              >
                {item.text}
              </p>
              <div className="flex items-center gap-3">
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-primary-fg)",
                    }}
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text)" }}
                >
                  {item.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
