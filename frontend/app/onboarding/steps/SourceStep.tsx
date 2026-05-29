"use client";

import { Sparkles, Globe } from "lucide-react";

interface SourceStepProps {
  onNext: () => void;
  onImport: () => void;
}

export function SourceStep({ onNext, onImport }: SourceStepProps) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Paso 2 de 6
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-3">
        ¿Ya tenés una tienda online?
      </h1>
      <p className="text-slate-300/80 mb-8 leading-relaxed">
        Podemos importar tus productos y diseño desde tu sitio web actual, o empezar de cero.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onNext}
          className="group p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-violet-400/60 hover:bg-violet-500/10 text-left transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 group-hover:border-violet-400/40 transition">
            <Sparkles className="w-6 h-6 text-violet-300" />
          </div>
          <h3 className="text-lg font-semibold mb-1 text-white">Crear desde cero</h3>
          <p className="text-sm text-slate-300/75 leading-relaxed">
            Empezá de cero y diseñá tu tienda paso a paso con nuestras plantillas.
          </p>
        </button>

        <button
          type="button"
          onClick={onImport}
          className="group p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:border-violet-400/60 hover:bg-violet-500/10 text-left transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 group-hover:border-violet-400/40 transition">
            <Globe className="w-6 h-6 text-violet-300" />
          </div>
          <h3 className="text-lg font-semibold mb-1 text-white">Importar desde mi web</h3>
          <p className="text-sm text-slate-300/75 leading-relaxed">
            Traé tus productos, imágenes y diseño desde tu sitio web actual automáticamente.
          </p>
        </button>
      </div>
    </div>
  );
}
