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
      <h1 className="heading-page text-2xl mb-2">Detalles de tu tienda</h1>
      <p className="text-text-muted mb-6">
        El slug será la URL de tu tienda: nexora.com/store/tu-slug
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Nombre de la tienda</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSlugFromName}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
            placeholder="Mi Tienda"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Slug (URL)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
            placeholder="mi-tienda"
          />
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg border border-white/20 hover:bg-white/5"
        >
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="bg-gradient-nexora px-6 py-3 rounded-lg font-semibold text-white hover:opacity-90"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
