"use client";

import { useState } from "react";

const TEMPLATES = [
  { id: "minimal", name: "Clásico", desc: "Tonos neutros, elegante y atemporal" },
  { id: "streetwear", name: "Audaz", desc: "Colores fuertes, impacto visual" },
  { id: "modern", name: "Profesional", desc: "Limpio, corporativo y tecnológico" },
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
  const [templateId, setTemplateId] = useState(data?.template_id || "minimal");

  const handleNext = () => {
    setData?.({ template_id: templateId });
    onNext();
  };

  return (
    <div>
      <h1 className="heading-page text-2xl mb-2">Elige tu plantilla</h1>
      <p className="text-text-muted mb-6">
        Podés cambiarla después en Apariencia
      </p>

      <div className="grid gap-4">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplateId(t.id)}
            className={`p-4 rounded-xl border text-left transition ${
              templateId === t.id
                ? "border-primary bg-primary/10"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className="font-semibold">{t.name}</div>
            <div className="text-sm text-text-muted">{t.desc}</div>
          </button>
        ))}
      </div>

      <div className="mt-8 flex gap-4">
        <button onClick={onBack} className="px-6 py-3 rounded-lg border border-white/20 hover:bg-white/5">
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="bg-gradient-agentro px-6 py-3 rounded-lg font-semibold text-white hover:opacity-90"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
