interface CustomTextSectionProps {
  config: {
    title?: string;
    body?: string;
    image?: string;
  };
}

export function CustomTextSection({ config }: CustomTextSectionProps) {
  const hasImage = !!config.image;

  return (
    <section className="py-16 md:py-20" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className={`${hasImage ? "grid md:grid-cols-2 gap-12 items-center" : "max-w-3xl mx-auto"}`}>
          <div>
            {config.title && (
              <h2
                className="text-2xl md:text-3xl font-bold mb-6"
                style={{ color: "var(--color-text)" }}
              >
                {config.title}
              </h2>
            )}
            {config.body && (
              <div
                className="text-base leading-relaxed whitespace-pre-line"
                style={{ color: "var(--color-muted)" }}
              >
                {config.body}
              </div>
            )}
          </div>
          {hasImage && (
            <div
              className="overflow-hidden"
              style={{ borderRadius: "var(--radius-card, 12px)" }}
            >
              <img
                src={config.image}
                alt={config.title || ""}
                className="w-full h-auto object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
