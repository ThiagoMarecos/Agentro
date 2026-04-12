import Link from "next/link";
import { Calendar, ImageIcon } from "lucide-react";
import { VideoHybridLayout } from "./VideoHybridLayout";

interface DropsVideoHybridProps {
  drops: any[];
  config: {
    layout?: string;
    drops: Record<string, any>;
    video: {
      url: string;
      title?: string;
      autoplay?: boolean;
    };
  };
  slug: string;
}

export function DropsVideoHybrid({ drops, config, slug }: DropsVideoHybridProps) {
  const videoConfig = config.video ?? { url: "" };
  const layout = (config.layout as any) || "right";
  const bgMode = layout === "background";

  if (drops.length === 0) return null;

  return (
    <VideoHybridLayout layout={layout} videoConfig={videoConfig}>
      <div>
        <h2
          className="text-2xl md:text-3xl font-bold mb-8"
          style={{ color: bgMode ? "inherit" : "var(--color-text)" }}
        >
          Próximos drops
        </h2>
        <div className={`grid ${bgMode ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"} gap-5`}>
          {drops.map((drop) => (
            <Link
              key={drop.id}
              href={`/store/${slug}/drops`}
              className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 rounded-xl"
              style={{
                backgroundColor: bgMode ? "rgba(255,255,255,0.1)" : "var(--color-surface)",
                backdropFilter: bgMode ? "blur(8px)" : undefined,
                border: bgMode ? "1px solid rgba(255,255,255,0.15)" : "var(--border-card, 1px solid rgba(0,0,0,0.08))",
                boxShadow: bgMode ? "none" : "var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06))",
              }}
            >
              <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: bgMode ? "rgba(0,0,0,0.2)" : "var(--color-surface)" }}>
                {drop.image_url ? (
                  <img src={drop.image_url} alt={drop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30" style={{ color: bgMode ? "#fff" : "var(--color-text)" }}>
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1 line-clamp-1" style={{ color: bgMode ? "inherit" : "var(--color-text)" }}>
                  {drop.name}
                </h3>
                {drop.drop_date && (
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: bgMode ? "rgba(255,255,255,0.8)" : "var(--color-primary)" }}>
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(drop.drop_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </VideoHybridLayout>
  );
}
