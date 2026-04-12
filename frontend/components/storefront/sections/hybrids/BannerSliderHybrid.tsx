"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BannerSliderHybridProps {
  config: {
    banner: {
      title: string;
      subtitle?: string;
      text_color?: string;
      link?: string;
      alignment?: "left" | "center" | "right";
    };
    image_slider: {
      images: Array<{ url: string; alt?: string; link?: string }>;
      autoplay?: boolean;
      interval?: number;
      height?: "small" | "medium" | "large";
    };
  };
}

const HEIGHT_MAP: Record<string, string> = {
  small: "min-h-[250px] md:min-h-[300px]",
  medium: "min-h-[350px] md:min-h-[450px]",
  large: "min-h-[450px] md:min-h-[600px]",
};

export function BannerSliderHybrid({ config }: BannerSliderHybridProps) {
  const bannerConfig = config.banner ?? { title: "" };
  const sliderConfig = config.image_slider ?? { images: [] };

  const images = sliderConfig.images ?? [];
  const autoplay = sliderConfig.autoplay ?? true;
  const interval = sliderConfig.interval ?? 5;
  const height = sliderConfig.height ?? "medium";
  const textColor = bannerConfig.text_color || "#ffffff";

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

  const alignClass =
    bannerConfig.alignment === "left"
      ? "text-left items-start"
      : bannerConfig.alignment === "right"
        ? "text-right items-end"
        : "text-center items-center";

  const innerContent = (
    <>
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
          backgroundColor: bgImage ? "rgba(0,0,0,0.4)" : "var(--color-primary, #6366f1)",
        }}
      />

      <div className={`relative z-10 w-full max-w-5xl mx-auto px-6 flex flex-col justify-center ${alignClass}`}>
        <h2 className="text-3xl md:text-4xl font-bold" style={{ color: textColor }}>
          {bannerConfig.title}
        </h2>
        {bannerConfig.subtitle && (
          <p className="mt-3 text-lg md:text-xl opacity-90" style={{ color: textColor }}>
            {bannerConfig.subtitle}
          </p>
        )}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
            aria-label="Anterior"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
            aria-label="Siguiente"
          >
            <ChevronRight size={22} />
          </button>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setCurrent(i); }}
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
    </>
  );

  if (bannerConfig.link) {
    return (
      <a
        href={bannerConfig.link}
        className={`relative ${heightClass} flex overflow-hidden hover:opacity-95 transition-opacity`}
      >
        {innerContent}
      </a>
    );
  }

  return (
    <div className={`relative ${heightClass} flex overflow-hidden`}>
      {innerContent}
    </div>
  );
}
