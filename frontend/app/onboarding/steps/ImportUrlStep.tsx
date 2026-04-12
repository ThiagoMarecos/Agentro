"use client";

import { useState } from "react";
import { Globe, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { analyzeUrl, type AnalyzeResponse } from "@/lib/api/import";

const LOADING_MESSAGES = [
  "Conectando con el sitio...",
  "Buscando productos...",
  "Analizando diseño...",
  "Detectando secciones...",
  "Casi listo...",
];

interface ImportUrlStepProps {
  onNext: (data: AnalyzeResponse) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function ImportUrlStep({ onNext, onBack, onSkip }: ImportUrlStepProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Ingresá la URL de tu tienda");
      return;
    }

    setError("");
    setLoading(true);
    setMsgIndex(0);

    const interval = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 3500);

    try {
      const result = await analyzeUrl(trimmed);
      clearInterval(interval);

      if (result.product_count === 0 && !result.design.primary_color && result.sections.length === 0) {
        setError("No encontramos productos ni diseño en esa URL. Verificá que sea correcta o continuá sin importar.");
        setLoading(false);
        return;
      }

      onNext(result);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Error al analizar el sitio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="heading-page text-2xl mb-2">Importar desde tu web</h1>
      <p className="text-text-muted mb-8">
        Ingresá la URL de tu tienda y vamos a buscar productos, imágenes y diseño automáticamente.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">URL de tu tienda</label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyze()}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:outline-none text-base"
              placeholder="https://mitienda.com"
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">{LOADING_MESSAGES[msgIndex]}</p>
              <p className="text-xs text-text-muted mt-0.5">Esto puede tomar unos segundos...</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition"
          disabled={loading}
        >
          Atrás
        </button>
        <button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          className="bg-gradient-agentro px-6 py-3 rounded-xl font-semibold text-white hover:opacity-90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              Analizar sitio
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-text-muted hover:text-white transition px-4 py-2"
          disabled={loading}
        >
          Continuar sin importar
        </button>
      </div>
    </div>
  );
}
