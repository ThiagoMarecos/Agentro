import { VideoHybridLayout } from "./VideoHybridLayout";

interface TextVideoHybridProps {
  config: {
    layout?: string;
    custom_text: {
      title?: string;
      body?: string;
      image?: string;
    };
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
}

export function TextVideoHybrid({ config }: TextVideoHybridProps) {
  const textConfig = config.custom_text ?? {};
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "right";

  const bgMode = layout === "background";

  return (
    <VideoHybridLayout layout={layout} videoConfig={videoConfig}>
      <div className={bgMode ? "max-w-3xl mx-auto px-6 text-center py-8" : ""}>
        {textConfig.title && (
          <h2
            className="text-2xl md:text-3xl font-bold mb-6"
            style={{ color: bgMode ? "inherit" : "var(--color-text)" }}
          >
            {textConfig.title}
          </h2>
        )}
        {textConfig.body && (
          <div
            className="text-base leading-relaxed whitespace-pre-line"
            style={{ color: bgMode ? "inherit" : "var(--color-text-muted)", opacity: bgMode ? 0.9 : 1 }}
          >
            {textConfig.body}
          </div>
        )}
      </div>
    </VideoHybridLayout>
  );
}
