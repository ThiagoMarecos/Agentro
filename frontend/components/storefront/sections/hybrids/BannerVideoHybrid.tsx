"use client";

import { VideoHybridLayout } from "./VideoHybridLayout";
import { getBackgroundEmbedUrl, isLocalVideo } from "./videoEmbed";

interface BannerVideoHybridProps {
  config: {
    layout?: string;
    banner: {
      title: string;
      subtitle?: string;
      text_color?: string;
      link?: string;
      alignment?: "left" | "center" | "right";
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
}

export function BannerVideoHybrid({ config }: BannerVideoHybridProps) {
  const bannerConfig = config.banner ?? { title: "" };
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "background";
  const textColor = bannerConfig.text_color || "#ffffff";

  const alignClass =
    bannerConfig.alignment === "left"
      ? "text-left"
      : bannerConfig.alignment === "right"
        ? "text-right"
        : "text-center";

  if (layout === "background") {
    const localVid = isLocalVideo(videoConfig.url || "");
    const embedSrc = localVid ? null : getBackgroundEmbedUrl(videoConfig.url || "");
    const hasVideo = localVid || !!embedSrc;

    const innerContent = (
      <>
        {localVid ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <video src={videoConfig.url} autoPlay muted loop playsInline className="absolute w-full h-full object-cover" />
          </div>
        ) : embedSrc ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
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
          <div className="absolute inset-0" style={{ backgroundColor: "var(--color-primary, #6366f1)" }} />
        )}
        <div className="absolute inset-0 z-[1]" style={{ backgroundColor: hasVideo ? "rgba(0,0,0,0.5)" : "transparent" }} />
        <div className={`relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-16 ${alignClass}`}>
          <h2 className="text-3xl md:text-4xl font-bold" style={{ color: textColor }}>{bannerConfig.title}</h2>
          {bannerConfig.subtitle && (
            <p className="mt-3 text-lg md:text-xl opacity-90" style={{ color: textColor }}>{bannerConfig.subtitle}</p>
          )}
        </div>
      </>
    );

    if (bannerConfig.link) {
      return (
        <a href={bannerConfig.link} className="block relative min-h-[250px] md:min-h-[350px] flex items-center overflow-hidden hover:opacity-95 transition-opacity">
          {innerContent}
        </a>
      );
    }
    return (
      <div className="relative min-h-[250px] md:min-h-[350px] flex items-center overflow-hidden">
        {innerContent}
      </div>
    );
  }

  const content = (
    <div className={`py-8 ${alignClass}`}>
      <h2 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--color-text)" }}>
        {bannerConfig.title}
      </h2>
      {bannerConfig.subtitle && (
        <p className="mt-3 text-lg" style={{ color: "var(--color-text-muted)" }}>
          {bannerConfig.subtitle}
        </p>
      )}
      {bannerConfig.link && (
        <a
          href={bannerConfig.link}
          className="inline-block mt-6 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
        >
          Ver más
        </a>
      )}
    </div>
  );

  return (
    <VideoHybridLayout layout={layout} videoConfig={videoConfig}>
      {content}
    </VideoHybridLayout>
  );
}
