"use client";

import { Sparkles, Globe } from "lucide-react";

interface SourceStepProps {
  onNext: () => void;
  onImport: () => void;
}

export function SourceStep({ onNext, onImport }: SourceStepProps) {
  return (
    <div>
      <h1 className="heading-page text-2xl mb-2">¿Ya tenés una tienda online?</h1>
      <p className="text-text-muted mb-8">
        Podemos importar tus productos y diseño desde tu sitio web actual, o empezar de cero.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onNext}
          className="group p-6 rounded-xl border border-white/10 hover:border-primary/50 hover:bg-primary/5 text-left transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Crear desde cero</h3>
          <p className="text-sm text-text-muted">
            Empezá de cero y diseñá tu tienda paso a paso con nuestras plantillas.
          </p>
        </button>

        <button
          type="button"
          onClick={onImport}
          className="group p-6 rounded-xl border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 text-left transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition">
            <Globe className="w-6 h-6 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Importar desde mi web</h3>
          <p className="text-sm text-text-muted">
            Traé tus productos, imágenes y diseño desde tu sitio web actual automáticamente.
          </p>
        </button>
      </div>
    </div>
  );
}
