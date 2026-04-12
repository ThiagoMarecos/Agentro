import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface HeroSectionProps {
  store: { name: string; description?: string; logo_url?: string | null };
  config: {
    style?: "centered" | "fullwidth" | "split" | "gradient";
    title?: string;
    subtitle?: string;
    cta_text?: string;
    bg_image?: string;
  };
  slug: string;
}

export function HeroSection({ store, config, slug }: HeroSectionProps) {
  const title = config.title || store.name;
  const subtitle = config.subtitle || store.description || "";
  const ctaText = config.cta_text || "Ver catálogo";
  const style = config.style || "centered";

  const ctaButton = (
    <Link
      href={`/store/${slug}/catalog`}
      className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-fg)",
      }}
    >
      {ctaText}
      <ArrowRight className="w-4 h-4" />
    </Link>
  );

  if (style === "centered") {
    return (
      <section
        className="relative py-24 md:py-32"
        style={{
          backgroundColor: "var(--color-surface)",
          backgroundImage: config.bg_image ? `url(${config.bg_image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {config.bg_image && (
          <div className="absolute inset-0 bg-black/40" />
        )}
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: config.bg_image ? "#fff" : "var(--color-text)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-lg md:text-xl mb-10 leading-relaxed"
              style={{ color: config.bg_image ? "rgba(255,255,255,0.85)" : "var(--color-text-muted)" }}
            >
              {subtitle}
            </p>
          )}
          {ctaButton}
        </div>
      </section>
    );
  }

  if (style === "fullwidth") {
    return (
      <section
        className="relative py-20 md:py-28"
        style={{
          backgroundColor: "var(--color-primary)",
          backgroundImage: config.bg_image ? `url(${config.bg_image})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {config.bg_image && (
          <div className="absolute inset-0 bg-black/40" />
        )}
        <div className="relative max-w-5xl mx-auto px-6">
          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: "var(--color-primary-fg)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-lg md:text-xl mb-10 max-w-2xl leading-relaxed"
              style={{ color: "var(--color-primary-fg)", opacity: 0.85 }}
            >
              {subtitle}
            </p>
          )}
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: "var(--color-primary-fg)", color: "var(--color-primary)" }}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    );
  }

  if (style === "split") {
    return (
      <section
        className="grid md:grid-cols-2 min-h-[480px]"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <div className="flex flex-col justify-center px-8 md:px-16 py-16">
          <h1
            className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
            style={{ color: "var(--color-text)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-lg mb-10 leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              {subtitle}
            </p>
          )}
          {ctaButton}
        </div>
        <div
          className="relative min-h-[300px] md:min-h-0"
          style={{
            backgroundColor: "var(--color-background)",
            backgroundImage: config.bg_image ? `url(${config.bg_image})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!config.bg_image && store.logo_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={store.logo_url}
                alt={store.name}
                className="max-w-[200px] max-h-[200px] object-contain"
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (style === "gradient") {
    return (
      <section
        className="relative py-24 md:py-32"
        style={{
          background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary, var(--color-accent)))",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: "var(--color-primary-fg)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-lg md:text-xl mb-10 leading-relaxed"
              style={{ color: "var(--color-primary-fg)", opacity: 0.85 }}
            >
              {subtitle}
            </p>
          )}
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: "var(--color-primary-fg)", color: "var(--color-primary)" }}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    );
  }

  return null;
}
