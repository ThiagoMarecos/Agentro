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
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Importar tienda
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">
        Importar desde tu web
      </h1>
      <p className="text-slate-300/80 mb-8 leading-relaxed">
        Ingresá la URL de tu tienda y vamos a buscar productos, imágenes y diseño automáticamente.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">
            URL de tu tienda
          </label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyze()}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/15 text-white placeholder-slate-500 focus:border-violet-400 focus:bg-violet-500/[0.06] focus:outline-none focus:ring-2 focus:ring-violet-500/15 transition text-base"
              placeholder="https://mitienda.com"
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-violet-500/[0.08] border border-violet-500/25">
            <Loader2 className="w-5 h-5 text-violet-300 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-violet-200">{LOADING_MESSAGES[msgIndex]}</p>
              <p className="text-xs text-slate-300/70 mt-0.5">Esto puede tomar unos segundos...</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 hover:border-white/25 transition text-sm font-medium"
            disabled={loading}
          >
            ← Atrás
          </button>
          <button
            onClick={onSkip}
            className="text-sm text-slate-400 hover:text-white transition px-3 py-3"
            disabled={loading}
          >
            Continuar sin importar
          </button>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          className="px-7 py-3 rounded-xl bg-white text-[#05060f] font-semibold text-sm shadow-[0_0_28px_-4px_rgba(139,111,255,0.5)] hover:bg-[#b39bff] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
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
      </div>
    </div>
  );
}
