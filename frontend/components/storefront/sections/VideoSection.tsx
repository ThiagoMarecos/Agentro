interface VideoSectionProps {
  config: {
    url: string;
    title?: string;
    autoplay?: boolean;
    source?: "url" | "file";
  };
}

const VIDEO_FILE_EXTS = [".mp4", ".webm", ".mov"];

function isLocalVideo(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.startsWith("/uploads/") && VIDEO_FILE_EXTS.some((ext) => lower.endsWith(ext));
}

function getEmbedUrl(url: string, autoplay: boolean): string | null {
  if (!url || isLocalVideo(url)) return null;
  try {
    const parsed = new URL(url);

    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com"
    ) {
      const id = parsed.searchParams.get("v");
      if (!id) return null;
      const params = new URLSearchParams();
      params.set("autoplay", "1");
      params.set("mute", "1");
      params.set("rel", "0");
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (!id) return null;
      const params = new URLSearchParams();
      params.set("autoplay", "1");
      params.set("mute", "1");
      params.set("rel", "0");
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    if (
      parsed.hostname === "www.vimeo.com" ||
      parsed.hostname === "vimeo.com"
    ) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      if (!id) return null;
      const params = new URLSearchParams();
      params.set("autoplay", "1");
      params.set("muted", "1");
      return `https://player.vimeo.com/video/${id}?${params.toString()}`;
    }

    return url;
  } catch {
    return null;
  }
}

export function VideoSection({ config }: VideoSectionProps) {
  const { url, title, autoplay = false } = config;

  if (isLocalVideo(url)) {
    return (
      <div className="py-8 px-4">
        {title && (
          <h2
            className="text-2xl font-bold text-center mb-6"
            style={{ color: "var(--color-text, #111827)" }}
          >
            {title}
          </h2>
        )}
        <div className="mx-auto w-full max-w-4xl">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <video
              src={url}
              title={title || "Video"}
              controls
              autoPlay={autoplay}
              muted={autoplay}
              playsInline
              className="absolute inset-0 w-full h-full rounded-lg object-contain bg-black"
            />
          </div>
        </div>
      </div>
    );
  }

  const embedUrl = getEmbedUrl(url, autoplay);

  if (!embedUrl) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--color-text, #6b7280)" }}>
        <p className="text-sm">URL de video no válida</p>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      {title && (
        <h2
          className="text-2xl font-bold text-center mb-6"
          style={{ color: "var(--color-text, #111827)" }}
        >
          {title}
        </h2>
      )}
      <div className="mx-auto w-full max-w-4xl">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            src={embedUrl}
            title={title || "Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full rounded-lg"
            style={{ border: 0 }}
          />
        </div>
      </div>
    </div>
  );
}
