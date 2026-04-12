"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getDrops } from "@/lib/api/storefront";
import { Calendar, Sparkles } from "lucide-react";

interface Drop {
  id: string;
  name: string;
  description?: string;
  drop_date?: string;
  image_url?: string;
}

export default function DropsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    getDrops(slug).then(setDrops).catch(() => setDrops([])).finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="bg-white min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-sm text-gray-400 mb-6">
          <Link href={`/store/${slug}`} className="hover:text-gray-700 transition" style={{ color: "var(--color-primary)" }}>Inicio</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-500">Drops</span>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>Próximos drops</h1>
        <p className="text-gray-500 mb-10">Lanzamientos y novedades que se vienen.</p>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : drops.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {drops.map((d) => (
              <div key={d.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg transition-all duration-300 group">
                {d.image_url ? (
                  <div className="aspect-video overflow-hidden">
                    <img src={d.image_url} alt={d.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-indigo-300" />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-1 text-lg" style={{ fontFamily: "var(--font-heading)" }}>{d.name}</h3>
                  {d.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{d.description}</p>}
                  {d.drop_date && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(d.drop_date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-12 sm:p-16 text-center">
            <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>No hay drops programados</h2>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Todavía no hay lanzamientos. Volvé pronto.</p>
            <Link href={`/store/${slug}`} className="font-medium text-sm" style={{ color: "var(--color-primary)" }}>Volver al inicio</Link>
          </div>
        )}
      </div>
    </div>
  );
}
