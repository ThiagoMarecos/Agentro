"use client";

import { type ReactNode } from "react";
import { getEmbedUrl, getBackgroundEmbedUrl, isLocalVideo } from "./videoEmbed";

type VideoLayout = "right" | "left" | "top" | "bottom" | "background";

interface VideoHybridLayoutProps {
  layout: VideoLayout;
  videoConfig: { url: string; title?: string; autoplay?: boolean };
  children: ReactNode;
  sectionClassName?: string;
  sectionStyle?: React.CSSProperties;
  bgOverlayTextColor?: string;
}

function VideoEmbed({ url, title, autoplay }: { url: string; title?: string; autoplay?: boolean }) {
  if (isLocalVideo(url)) {
    return (
      <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
        <video
          src={url}
          title={title || "Video"}
          controls
          autoPlay={autoplay}
          muted={autoplay}
          playsInline
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />
      </div>
    );
  }

  const embedUrl = getEmbedUrl(url || "", autoplay ?? false);
  if (!embedUrl) {
    return (
      <div
        className="relative w-full rounded-xl flex items-center justify-center"
        style={{ paddingBottom: "56.25%", backgroundColor: "var(--color-surface-alt, #f3f4f6)" }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--color-text-subtle, #9ca3af)" }}>
          Sin video configurado
        </span>
      </div>
    );
  }
  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
      <iframe
        src={embedUrl}
        title={title || "Video"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        style={{ border: 0 }}
      />
    </div>
  );
}

function BackgroundVideo({ url }: { url: string }) {
  if (isLocalVideo(url)) {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          src={url}
          autoPlay
          muted
          loop
          playsInline
          className="absolute w-full h-full object-cover"
        />
      </div>
    );
  }

  const bgSrc = getBackgroundEmbedUrl(url);
  if (!bgSrc) return <div className="absolute inset-0" style={{ backgroundColor: "var(--color-surface)" }} />;

  return (
    <div className="absolute inset-0 z-0">
      <iframe
        src={bgSrc}
        className="absolute w-[300%] h-[300%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ border: 0, pointerEvents: "none" }}
        allow="autoplay; encrypted-media"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

export function VideoHybridLayout({
  layout,
  videoConfig,
  children,
  sectionClassName = "",
  sectionStyle,
  bgOverlayTextColor,
}: VideoHybridLayoutProps) {
  if (layout === "background") {
    const hasVideo = isLocalVideo(videoConfig.url) || !!getBackgroundEmbedUrl(videoConfig.url || "");
    return (
      <section
        className={`relative min-h-[400px] md:min-h-[500px] flex items-center overflow-hidden ${sectionClassName}`}
        style={sectionStyle}
      >
        <BackgroundVideo url={videoConfig.url || ""} />
        <div
          className="absolute inset-0 z-[1]"
          style={{ backgroundColor: hasVideo ? "rgba(0,0,0,0.55)" : "transparent" }}
        />
        <div className="relative z-10 w-full" style={{ color: bgOverlayTextColor || (hasVideo ? "#fff" : "var(--color-text)") }}>
          {children}
        </div>
      </section>
    );
  }

  const isVertical = layout === "top" || layout === "bottom";
  const videoFirst = layout === "left" || layout === "top";

  const gridClass = isVertical
    ? "flex flex-col gap-8"
    : "grid md:grid-cols-2 gap-8 items-start";

  const videoBlock = (
    <div className={isVertical ? "w-full" : ""}>
      {videoConfig.title && (
        <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--color-text)" }}>
          {videoConfig.title}
        </h3>
      )}
      <VideoEmbed url={videoConfig.url} title={videoConfig.title} autoplay={videoConfig.autoplay} />
    </div>
  );

  const contentBlock = (
    <div className={isVertical ? "w-full" : ""}>
      {children}
    </div>
  );

  return (
    <section
      className={`py-16 md:py-20 ${sectionClassName}`}
      style={sectionStyle ?? { backgroundColor: "var(--color-background)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className={gridClass}>
          {videoFirst ? (
            <>{videoBlock}{contentBlock}</>
          ) : (
            <>{contentBlock}{videoBlock}</>
          )}
        </div>
      </div>
    </section>
  );
}
