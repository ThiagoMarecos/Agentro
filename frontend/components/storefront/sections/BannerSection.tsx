interface BannerSectionProps {
  config: {
    title: string;
    subtitle?: string;
    bg_color?: string;
    text_color?: string;
    link?: string;
    bg_image?: string;
    alignment?: "left" | "center" | "right";
  };
}

export function BannerSection({ config }: BannerSectionProps) {
  const {
    title,
    subtitle,
    bg_color,
    text_color = "#ffffff",
    link,
    bg_image,
    alignment = "center",
  } = config;

  const alignClass =
    alignment === "left"
      ? "text-left"
      : alignment === "right"
        ? "text-right"
        : "text-center";

  const style: React.CSSProperties = {
    backgroundColor: bg_image ? undefined : (bg_color || "var(--color-primary, #6366f1)"),
    color: text_color,
    ...(bg_image && {
      backgroundImage: `url(${bg_image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }),
  };

  const content = (
    <div className={`w-full py-8 px-6 ${alignClass}`} style={style}>
      {bg_image && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
        />
      )}
      <div className="relative z-10 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
        {subtitle && <p className="mt-2 text-lg opacity-90">{subtitle}</p>}
      </div>
    </div>
  );

  if (link) {
    return (
      <a
        href={link}
        className="block relative overflow-hidden hover:opacity-95 transition-opacity"
      >
        {content}
      </a>
    );
  }

  return <div className="relative overflow-hidden">{content}</div>;
}
