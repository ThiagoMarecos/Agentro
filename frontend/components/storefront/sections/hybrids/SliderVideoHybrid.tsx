"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { VideoHybridLayout } from "./VideoHybridLayout";

interface SliderVideoHybridProps {
  config: {
    layout?: string;
    image_slider: {
      images: Array<{ url: string; alt?: string; link?: string }>;
      autoplay?: boolean;
      interval?: number;
      height?: "small" | "medium" | "large";
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
}

function SliderContent({ sliderConfig }: { sliderConfig: SliderVideoHybridProps["config"]["image_slider"] }) {
  const images = sliderConfig.images ?? [];
  const autoplay = sliderConfig.autoplay ?? true;
  const interval = sliderConfig.interval ?? 5;

  const [current, setCurrent] = useState(0);

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

  if (images.length === 0) {
    return (
      <div
        className="w-full rounded-xl flex flex-col items-center justify-center gap-2"
        style={{ aspectRatio: "16 / 9", backgroundColor: "var(--color-surface-alt, #f3f4f6)" }}
      >
        <ImageIcon size={36} style={{ color: "var(--color-text-subtle, #9ca3af)" }} />
        <span className="text-sm" style={{ color: "var(--color-text-subtle, #9ca3af)" }}>Sin imágenes</span>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 9" }}>
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {images.map((image, i) => (
          <div key={i} className="w-full h-full flex-shrink-0">
            {image.link ? (
              <a href={image.link} className="block w-full h-full">
                <img src={image.url} alt={image.alt || ""} className="w-full h-full object-contain" draggable={false} />
              </a>
            ) : (
              <img src={image.url} alt={image.alt || ""} className="w-full h-full object-contain" draggable={false} />
            )}
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", color: "#fff" }}
            aria-label="Anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", color: "#fff" }}
            aria-label="Siguiente"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="w-2 h-2 rounded-full transition-colors"
                style={{ backgroundColor: i === current ? "var(--color-primary, #fff)" : "rgba(255,255,255,0.5)" }}
                aria-label={`Imagen ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SliderVideoHybrid({ config }: SliderVideoHybridProps) {
  const sliderConfig = config.image_slider ?? { images: [] };
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "right";

  return (
    <VideoHybridLayout layout={layout} videoConfig={videoConfig}>
      <SliderContent sliderConfig={sliderConfig} />
    </VideoHybridLayout>
  );
}
