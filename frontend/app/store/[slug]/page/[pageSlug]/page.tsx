"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getStorefrontPage } from "@/lib/api/storefront";
import { FileText } from "lucide-react";

interface PageBlock {
  type: "text" | "image" | "video" | "products" | "cta";
  config: Record<string, any>;
}

interface PageData {
  id: string;
  title: string;
  slug: string;
  blocks: PageBlock[];
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function BlockRenderer({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "text":
      return (
        <div className="max-w-none">
          {(block.config.content ?? "").split("\n").map((line: string, i: number) =>
            line.trim() ? (
              <p key={i} className="text-gray-700 leading-relaxed mb-3">{line}</p>
            ) : (
              <br key={i} />
            ),
          )}
        </div>
      );

    case "image":
      return block.config.url ? (
        <div className="flex justify-center">
          <img src={block.config.url} alt={block.config.alt || ""} className="max-w-full rounded-2xl shadow-sm" />
        </div>
      ) : null;

    case "video": {
      const url = block.config.url ?? "";
      const ytId = getYouTubeId(url);
      if (ytId) {
        return (
          <div className="aspect-video rounded-2xl overflow-hidden shadow-sm">
            <iframe
              src={`https://www.youtube.com/embed/${ytId}`}
              title="Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        );
      }
      return url ? (
        <div className="aspect-video rounded-2xl overflow-hidden shadow-sm">
          <video src={url} controls className="w-full h-full object-cover" />
        </div>
      ) : null;
    }

    case "cta":
      return (
        <div className="text-center py-10 px-6 bg-gray-50 rounded-2xl">
          {block.config.title && (
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{block.config.title}</h2>
          )}
          {block.config.url && (
            <a
              href={block.config.url}
              className="inline-flex items-center gap-2 px-6 py-3 font-medium transition hover:opacity-90 rounded-full"
              style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
            >
              {block.config.button_text || "Ver más"}
            </a>
          )}
        </div>
      );

    case "products":
      return (
        <div className="text-center py-6 text-gray-400 text-sm">
          Productos destacados
        </div>
      );

    default:
      return null;
  }
}

export default function StorePageView() {
  const params = useParams();
  const slug = params.slug as string;
  const pageSlug = params.pageSlug as string;
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug || !pageSlug) return;
    getStorefrontPage(slug, pageSlug)
      .then(setPage)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug, pageSlug]);

  if (loading) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="bg-white min-h-[60vh]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Página no encontrada</h1>
          <p className="text-gray-500 mb-6">La página que buscas no existe o no está publicada.</p>
          <Link href={`/store/${slug}`} className="font-medium text-sm" style={{ color: "var(--color-primary)" }}>Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-sm text-gray-400 mb-6">
          <Link href={`/store/${slug}`} className="transition hover:text-gray-700" style={{ color: "var(--color-primary)" }}>Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">{page.title}</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-10" style={{ fontFamily: "var(--font-heading)" }}>{page.title}</h1>

        <div className="space-y-8">
          {page.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}
