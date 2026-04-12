"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const TEMPLATES = [
  {
    id: "streetwear",
    name: "Streetwear",
    desc: "Estética urbana y bold. Ideal para moda, zapatillas y lifestyle.",
    colors: { bg: "#0F172A", primary: "#6366F1", accent: "#22C55E", text: "#F8FAFC" },
  },
  {
    id: "boutique",
    name: "Boutique",
    desc: "Cálido y sofisticado. Perfecto para moda femenina, accesorios y joyería.",
    colors: { bg: "#FDF8F4", primary: "#E11D48", accent: "#F59E0B", text: "#1C1917" },
  },
  {
    id: "tech",
    name: "Tech",
    desc: "Tecnológico y premium. Ideal para electrónica, gadgets y software.",
    colors: { bg: "#020617", primary: "#06B6D4", accent: "#A855F7", text: "#F8FAFC" },
  },
  {
    id: "artesanal",
    name: "Artesanal",
    desc: "Natural y artesanal. Para productos orgánicos, handmade y alimentos.",
    colors: { bg: "#FFFBEB", primary: "#92400E", accent: "#D97706", text: "#1C1917" },
  },
];

export function TemplateStep({
  onNext,
  onBack,
  data,
  setData,
}: {
  onNext: () => void;
  onBack: () => void;
  data?: { template_id?: string };
  setData?: (d: { template_id: string }) => void;
}) {
  const [templateId, setTemplateId] = useState(data?.template_id || "streetwear");

  const handleNext = () => {
    setData?.({ template_id: templateId });
    onNext();
  };

  return (
    <div>
      <h1 className="heading-page text-2xl mb-1">Elegí tu plantilla</h1>
      <p className="text-text-muted text-sm mb-6">
        Define el estilo visual de tu tienda. Podés cambiarla después en Apariencia.
      </p>

      <div className="grid gap-3">
        {TEMPLATES.map((t) => {
          const selected = templateId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`relative flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                selected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"
              }`}
            >
              {/* Color preview */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex flex-col"
                style={{ backgroundColor: t.colors.bg }}
              >
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-5 h-1.5 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                </div>
                <div className="h-3 flex items-center justify-center gap-1 px-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colors.primary, opacity: 0.7 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colors.accent, opacity: 0.7 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colors.primary, opacity: 0.4 }} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-text-muted mt-0.5 leading-relaxed">{t.desc}</div>
              </div>

              {/* Check */}
              {selected && (
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-white/[0.15] hover:bg-white/[0.04] transition-colors text-sm font-medium"
        >
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="flex-1 bg-gradient-agentro px-6 py-3 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity text-sm"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
