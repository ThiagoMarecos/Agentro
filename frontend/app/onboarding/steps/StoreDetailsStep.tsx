"use client";

import { useState } from "react";

interface StoreData {
  name: string;
  slug: string;
}

export function StoreDetailsStep({
  onNext,
  onBack,
  data,
  setData,
}: {
  onNext: () => void;
  onBack: () => void;
  data?: StoreData;
  setData?: (d: StoreData) => void;
}) {
  const [name, setName] = useState(data?.name || "");
  const [slug, setSlug] = useState(data?.slug || "");
  const [error, setError] = useState("");

  const handleSlugFromName = () => {
    if (slug) return;
    const s = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(s);
  };

  const handleNext = () => {
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!slug.trim()) {
      setError("El slug es requerido");
      return;
    }
    setData?.({ name, slug });
    onNext();
  };

  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Paso 3 de 6
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">
        Detalles de tu tienda
      </h1>
      <p className="text-slate-300/80 mb-6 leading-relaxed">
        El slug será la URL pública de tu tienda:{" "}
        <code className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded text-sm">
          getagentro.com/store/{slug || "tu-slug"}
        </code>
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Nombre de la tienda
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onBlur={handleSlugFromName}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/15 text-white placeholder-slate-500 focus:border-violet-400 focus:bg-violet-500/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition"
            placeholder="Mi Tienda"
            maxLength={100}
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            Slug (URL)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setError(""); }}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/15 text-white placeholder-slate-500 focus:border-violet-400 focus:bg-violet-500/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition font-mono"
            placeholder="mi-tienda"
            maxLength={60}
          />
        </div>
      </div>

      <div className="mt-8 flex gap-3 justify-between">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 hover:border-white/25 transition text-sm font-medium"
        >
          ← Atrás
        </button>
        <button
          onClick={handleNext}
          className="px-7 py-3 rounded-xl bg-white text-[#05060f] font-semibold text-sm shadow-[0_0_28px_-4px_rgba(139,111,255,0.5)] hover:bg-[#b39bff] hover:text-white transition-all"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
