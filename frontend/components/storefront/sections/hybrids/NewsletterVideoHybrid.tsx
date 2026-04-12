"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { VideoHybridLayout } from "./VideoHybridLayout";

interface NewsletterVideoHybridProps {
  config: {
    layout?: string;
    newsletter: {
      title?: string;
      description?: string;
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
}

export function NewsletterVideoHybrid({ config }: NewsletterVideoHybridProps) {
  const [email, setEmail] = useState("");
  const nlConfig = config.newsletter ?? {};
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "right";
  const bgMode = layout === "background";

  const title = nlConfig.title || "Suscríbete a nuestro newsletter";
  const description = nlConfig.description || "Recibe las últimas novedades y ofertas exclusivas.";

  return (
    <VideoHybridLayout
      layout={layout}
      videoConfig={videoConfig}
      sectionStyle={{ backgroundColor: "var(--color-primary)" }}
      bgOverlayTextColor="#fff"
    >
      <div className={bgMode ? "max-w-2xl mx-auto px-6 text-center py-8" : "text-center md:text-left"}>
        <h2
          className="text-2xl md:text-3xl font-bold mb-4"
          style={{ color: "var(--color-primary-fg)" }}
        >
          {title}
        </h2>
        <p className="mb-8 leading-relaxed" style={{ color: "var(--color-primary-fg)", opacity: 0.85 }}>
          {description}
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className={`flex flex-col sm:flex-row gap-3 ${bgMode ? "max-w-md mx-auto" : "max-w-md mx-auto md:mx-0"}`}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="flex-1 px-5 py-3 rounded-full text-sm outline-none transition-shadow focus:ring-2"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", color: "#111" }}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: "var(--color-accent)", color: "var(--color-accent-fg)" }}
          >
            Suscribirse
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </VideoHybridLayout>
  );
}
