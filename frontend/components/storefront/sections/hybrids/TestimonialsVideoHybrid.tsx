"use client";

import { Quote } from "lucide-react";
import { VideoHybridLayout } from "./VideoHybridLayout";

interface TestimonialsVideoHybridProps {
  config: {
    layout?: string;
    testimonials: {
      items: Array<{ name: string; text: string; avatar?: string }>;
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
}

export function TestimonialsVideoHybrid({ config }: TestimonialsVideoHybridProps) {
  const items = config.testimonials?.items ?? [];
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "right";
  const bgMode = layout === "background";

  return (
    <VideoHybridLayout layout={layout} videoConfig={videoConfig}>
      <div>
        <h2
          className="text-2xl md:text-3xl font-bold mb-8 text-center"
          style={{ color: bgMode ? "inherit" : "var(--color-text)" }}
        >
          Lo que dicen nuestros clientes
        </h2>
        <div className={`grid ${bgMode ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"} gap-4`}>
          {items.map((item, index) => (
            <div
              key={index}
              className="p-5 flex flex-col rounded-xl"
              style={{
                backgroundColor: bgMode ? "rgba(255,255,255,0.1)" : "var(--color-surface)",
                backdropFilter: bgMode ? "blur(8px)" : undefined,
                border: bgMode ? "1px solid rgba(255,255,255,0.15)" : "var(--border-card, 1px solid rgba(0,0,0,0.08))",
                boxShadow: bgMode ? "none" : "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
              }}
            >
              <Quote className="w-5 h-5 mb-3 opacity-30" style={{ color: bgMode ? "#fff" : "var(--color-primary)" }} />
              <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: bgMode ? "inherit" : "var(--color-text)" }}>
                {item.text}
              </p>
              <div className="flex items-center gap-3">
                {item.avatar ? (
                  <img src={item.avatar} alt={item.name} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: bgMode ? "rgba(255,255,255,0.2)" : "var(--color-primary)",
                      color: bgMode ? "#fff" : "var(--color-primary-fg)",
                    }}
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium" style={{ color: bgMode ? "inherit" : "var(--color-text)" }}>
                  {item.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </VideoHybridLayout>
  );
}
