"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

interface ImageSliderSectionProps {
  config: {
    images: Array<{ url: string; alt?: string; link?: string }>;
    autoplay?: boolean;
    interval?: number;
    height?: "small" | "medium" | "large";
  };
}

const ASPECT_MAP: Record<string, string> = {
  small: "1920 / 300",
  medium: "1920 / 450",
  large: "1920 / 600",
};

export function ImageSliderSection({ config }: ImageSliderSectionProps) {
  const { images, autoplay = false, interval = 5, height = "medium" } = config;
  const [current, setCurrent] = useState(0);
  const aspectRatio = ASPECT_MAP[height] ?? ASPECT_MAP.medium;

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!autoplay || images.length <= 1) return;
    const timer = setInterval(next, interval * 1000);
    return () => clearInterval(timer);
  }, [autoplay, interval, next, images.length]);

  if (!images || images.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 w-full"
        style={{ aspectRatio, backgroundColor: "var(--color-surface-alt, #f3f4f6)" }}
      >
        <ImageIcon size={48} style={{ color: "var(--color-text-subtle, #9ca3af)" }} />
        <span className="text-sm" style={{ color: "var(--color-text-subtle, #9ca3af)" }}>No hay imágenes</span>
      </div>
    );
  }

  const renderSlide = (image: (typeof images)[number]) => {
    const img = (
      <img
        src={image.url}
        alt={image.alt || ""}
        className="w-full h-full object-contain"
        draggable={false}
      />
    );

    if (image.link) {
      return (
        <a href={image.link} className="block w-full h-full">
          {img}
        </a>
      );
    }

    return img;
  };

  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio }}>
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {images.map((image, i) => (
          <div key={i} className="w-full h-full flex-shrink-0">
            {renderSlide(image)}
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: "rgba(0,0,0,0.4)",
              color: "#fff",
            }}
            aria-label="Anterior"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: "rgba(0,0,0,0.4)",
              color: "#fff",
            }}
            aria-label="Siguiente"
          >
            <ChevronRight size={22} />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  backgroundColor:
                    i === current
                      ? "var(--color-primary, #fff)"
                      : "rgba(255,255,255,0.5)",
                }}
                aria-label={`Ir a imagen ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
