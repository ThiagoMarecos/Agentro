interface DividerSectionProps {
  config: {
    style: "line" | "dots" | "space" | "wave";
    height?: number;
  };
}

export function DividerSection({ config }: DividerSectionProps) {
  const { style, height = 40 } = config;

  if (style === "space") {
    return <div style={{ height }} />;
  }

  if (style === "line") {
    return (
      <div className="flex items-center justify-center px-6" style={{ height }}>
        <div
          className="w-full max-w-5xl"
          style={{
            height: 1,
            backgroundColor: "var(--color-border, #e5e7eb)",
          }}
        />
      </div>
    );
  }

  if (style === "dots") {
    return (
      <div className="flex items-center justify-center gap-3" style={{ height }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-text, #6b7280)" }}
          />
        ))}
      </div>
    );
  }

  if (style === "wave") {
    return (
      <div style={{ height, overflow: "hidden", lineHeight: 0 }}>
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: "100%", display: "block" }}
        >
          <path
            d="M0,40 C360,80 720,0 1080,40 C1260,60 1380,50 1440,40 L1440,80 L0,80 Z"
            fill="var(--color-primary, #6366f1)"
            opacity="0.15"
          />
          <path
            d="M0,50 C320,10 640,70 960,30 C1120,10 1300,50 1440,30 L1440,80 L0,80 Z"
            fill="var(--color-primary, #6366f1)"
            opacity="0.08"
          />
        </svg>
      </div>
    );
  }

  return null;
}
