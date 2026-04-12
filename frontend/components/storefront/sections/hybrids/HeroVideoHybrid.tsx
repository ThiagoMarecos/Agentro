"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VideoHybridLayout } from "./VideoHybridLayout";
import { getBackgroundEmbedUrl, isLocalVideo } from "./videoEmbed";

interface HeroVideoHybridProps {
  store: { name: string; description?: string };
  config: {
    layout?: string;
    hero: {
      style?: string;
      title?: string;
      subtitle?: string;
      cta_text?: string;
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
  slug: string;
}

export function HeroVideoHybrid({ store, config, slug }: HeroVideoHybridProps) {
  const heroConfig = config.hero ?? {};
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "background";

  const title = heroConfig.title || store.name;
  const subtitle = heroConfig.subtitle || store.description || "";
  const ctaText = heroConfig.cta_text || "Ver catálogo";

  if (layout === "background") {
    const localVid = isLocalVideo(videoConfig.url || "");
    const embedSrc = localVid ? null : getBackgroundEmbedUrl(videoConfig.url || "");
    const hasVideo = localVid || !!embedSrc;

    return (
      <section className="relative min-h-[500px] md:min-h-[600px] flex items-center overflow-hidden">
        {localVid ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <video
              src={videoConfig.url}
              autoPlay
              muted
              loop
              playsInline
              className="absolute w-full h-full object-cover"
            />
          </div>
        ) : embedSrc ? (
          <div className="absolute inset-0 z-0">
            <iframe
              src={embedSrc}
              className="absolute w-[300%] h-[300%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ border: 0, pointerEvents: "none" }}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: "var(--color-surface)" }} />
        )}
        <div
          className="absolute inset-0 z-[1]"
          style={{ backgroundColor: hasVideo ? "rgba(0,0,0,0.55)" : "transparent" }}
        />
        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 text-center">
          <h1
            className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
            style={{ color: hasVideo ? "#fff" : "var(--color-text)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-lg md:text-xl mb-10 leading-relaxed"
              style={{ color: hasVideo ? "rgba(255,255,255,0.85)" : "var(--color-text-muted)" }}
            >
              {subtitle}
            </p>
          )}
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <VideoHybridLayout
      layout={layout}
      videoConfig={videoConfig}
      sectionStyle={{ backgroundColor: "var(--color-surface)" }}
    >
      <div className="flex flex-col justify-center py-8 md:py-16">
        <h1
          className="text-3xl md:text-5xl font-bold mb-6 leading-tight"
          style={{ color: "var(--color-text)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg mb-10 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        )}
        <div>
          <Link
            href={`/store/${slug}/catalog`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </VideoHybridLayout>
  );
}
