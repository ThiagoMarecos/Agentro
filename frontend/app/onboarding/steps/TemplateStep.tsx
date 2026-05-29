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
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Paso 5 de 6
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-2">
        Elegí tu plantilla
      </h1>
      <p className="text-slate-300/80 text-sm mb-6 leading-relaxed">
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
              className={`relative flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                selected
                  ? "border-violet-400/60 bg-violet-500/10 ring-1 ring-violet-400/30 shadow-[0_0_24px_-8px_rgba(139,111,255,0.6)]"
                  : "border-white/10 bg-white/[0.03] hover:border-violet-400/40 hover:bg-violet-500/[0.06]"
              }`}
            >
              {/* Color preview */}
              <div
                className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-white/10 flex flex-col"
                style={{ backgroundColor: t.colors.bg }}
              >
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                </div>
                <div className="h-3.5 flex items-center justify-center gap-1 px-1">
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colors.primary, opacity: 0.7 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colors.accent, opacity: 0.7 }} />
                  <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: t.colors.primary, opacity: 0.4 }} />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-white">{t.name}</div>
                <div className="text-xs text-slate-300/70 mt-0.5 leading-relaxed">{t.desc}</div>
              </div>

              {/* Check */}
              {selected && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center shadow-[0_0_14px_rgba(139,111,255,0.6)]">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          );
        })}
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
