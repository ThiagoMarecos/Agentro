"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

interface HeroSliderHybridProps {
  store: { name: string; description?: string; logo_url?: string | null };
  config: {
    hero: {
      style?: string;
      title?: string;
      subtitle?: string;
      cta_text?: string;
    };
    image_slider: {
      images: Array<{ url: string; alt?: string; link?: string }>;
      autoplay?: boolean;
      interval?: number;
      height?: "small" | "medium" | "large";
    };
  };
  slug: string;
}

const HEIGHT_MAP: Record<string, string> = {
  small: "min-h-[300px] md:min-h-[400px]",
  medium: "min-h-[400px] md:min-h-[520px]",
  large: "min-h-[500px] md:min-h-[640px]",
};

export function HeroSliderHybrid({ store, config, slug }: HeroSliderHybridProps) {
  const heroConfig = config.hero ?? {};
  const sliderConfig = config.image_slider ?? { images: [] };

  const title = heroConfig.title || store.name;
  const subtitle = heroConfig.subtitle || store.description || "";
  const ctaText = heroConfig.cta_text || "Ver catálogo";
  const images = sliderConfig.images ?? [];
  const autoplay = sliderConfig.autoplay ?? true;
  const interval = sliderConfig.interval ?? 5;
  const height = sliderConfig.height ?? "medium";

  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const next = useCallback(() => {
    if (images.length <= 1) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrent((prev) => (prev + 1) % images.length);
      setTransitioning(false);
    }, 600);
  }, [images.length]);

  const prev = useCallback(() => {
    if (images.length <= 1) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrent((prev) => (prev - 1 + images.length) % images.length);
      setTransitioning(false);
    }, 600);
  }, [images.length]);

  useEffect(() => {
    if (!autoplay || images.length <= 1) return;
    const timer = setInterval(next, interval * 1000);
    return () => clearInterval(timer);
  }, [autoplay, interval, next, images.length]);

  const heightClass = HEIGHT_MAP[height] ?? HEIGHT_MAP.medium;
  const bgImage = images[current]?.url;

  return (
    <section className={`relative ${heightClass} flex items-center overflow-hidden`}>
      {bgImage && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
            transitioning ? "opacity-0" : "opacity-100"
          }`}
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          backgroundColor: bgImage ? "rgba(0,0,0,0.45)" : "var(--color-surface)",
        }}
      />

      <div className="relative z-10 w-full max-w-3xl mx-auto px-6 text-center">
        <h1
          className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
          style={{ color: bgImage ? "#fff" : "var(--color-text)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="text-lg md:text-xl mb-10 leading-relaxed"
            style={{
              color: bgImage ? "rgba(255,255,255,0.85)" : "var(--color-text-muted)",
            }}
          >
            {subtitle}
          </p>
        )}
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
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
            aria-label="Anterior"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
            aria-label="Siguiente"
          >
            <ChevronRight size={22} />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="w-2.5 h-2.5 rounded-full transition-all"
                style={{
                  backgroundColor: i === current ? "#fff" : "rgba(255,255,255,0.45)",
                  transform: i === current ? "scale(1.2)" : "scale(1)",
                }}
                aria-label={`Ir a imagen ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
