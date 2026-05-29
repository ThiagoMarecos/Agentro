"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStore as createOnboardingStore } from "@/lib/api/onboarding";
import { createStore as createAdditionalStore } from "@/lib/api/stores";
import { executeImport } from "@/lib/api/import";
import { useStore } from "@/lib/context/StoreContext";
import { Loader2, CheckCircle2, Package, Palette, Layout } from "lucide-react";
import type { ImportSelections } from "./ImportPreviewStep";

const TEMPLATE_NAMES: Record<string, string> = {
  minimal: "Clásico",
  streetwear: "Audaz",
  modern: "Profesional",
};

interface FormData {
  name: string;
  slug: string;
  industry?: string;
  country?: string;
  currency?: string;
  language?: string;
  template_id?: string;
  importData?: ImportSelections;
}

type ProgressPhase = "idle" | "creating" | "importing_products" | "importing_design" | "done";

const PHASE_LABELS: Record<ProgressPhase, string> = {
  idle: "",
  creating: "Creando tu tienda...",
  importing_products: "Importando productos e imágenes...",
  importing_design: "Aplicando diseño y secciones...",
  done: "¡Todo listo!",
};

export function FinishStep({
  onBack,
  data,
}: {
  onBack: () => void;
  data: FormData;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<ProgressPhase>("idle");
  const router = useRouter();
  const storeContext = useStore();

  const hasImport = !!data.importData;
  const importInfo = data.importData;

  const handleCreate = async () => {
    setError("");
    setLoading(true);

    try {
      setPhase("creating");

      const storePayload = {
        name: data.name,
        slug: data.slug,
        industry: data.industry || undefined,
        country: data.country || undefined,
        currency: data.currency || "USD",
        language: data.language || "es",
        template_id: data.template_id || "minimal",
      };

      // Try onboarding endpoint first (first store), fallback to stores endpoint (additional stores)
      let storeId: string;
      try {
        const result = await createOnboardingStore(storePayload);
        storeId = result.store.id;
      } catch (onboardingErr: any) {
        // If onboarding blocks because user already has stores, use the general endpoint
        if (onboardingErr.message?.includes("ya tiene una tienda")) {
          const result = await createAdditionalStore(storePayload);
          storeId = result.id;
        } else {
          throw onboardingErr;
        }
      }

      if (importInfo && (importInfo.importProducts || importInfo.importDesign || importInfo.importSections)) {
        if (importInfo.importProducts && importInfo.products.length > 0) {
          setPhase("importing_products");
        }

        if (importInfo.importDesign || importInfo.importSections) {
          setPhase((prev) => prev === "importing_products" ? prev : "importing_design");
        }

        try {
          await executeImport(storeId, {
            url: importInfo.url || "",
            products: importInfo.products,
            design: importInfo.design,
            sections: importInfo.sections,
            import_products: importInfo.importProducts,
            import_design: importInfo.importDesign,
            import_sections: importInfo.importSections,
          });
        } catch (importErr) {
          console.warn("Import had errors:", importErr);
        }
      }

      setPhase("done");
      await storeContext.refresh();
      setTimeout(() => router.push("/app"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear tienda");
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Paso 6 de 6 · Confirmar
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-2">
        Resumen
      </h1>
      <p className="text-slate-300/80 mb-6 leading-relaxed">
        Revisá todo y creá tu tienda.
      </p>

      <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 mb-4 space-y-2.5">
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Nombre</span>
          <span className="text-sm text-white font-medium text-right">{data.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Slug</span>
          <code className="text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded">{data.slug}</code>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Moneda</span>
          <span className="text-sm text-white">{data.currency || "USD"}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Plantilla</span>
          <span className="text-sm text-white">{TEMPLATE_NAMES[data.template_id || "minimal"] ?? data.template_id}</span>
        </div>
      </div>

      {hasImport && importInfo && (
        <div className="p-5 rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] mb-6 space-y-2.5">
          <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider font-mono mb-1">
            Importación programada
          </p>
          {importInfo.importProducts && importInfo.products.length > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-slate-200">
              <Package className="w-4 h-4 text-violet-300" />
              <span>{importInfo.products.length} productos</span>
            </div>
          )}
          {importInfo.importDesign && (
            <div className="flex items-center gap-2.5 text-sm text-slate-200">
              <Palette className="w-4 h-4 text-violet-300" />
              <span>Diseño (colores, fuentes, logo)</span>
            </div>
          )}
          {importInfo.importSections && importInfo.sections.length > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-slate-200">
              <Layout className="w-4 h-4 text-violet-300" />
              <span>{importInfo.sections.length} secciones</span>
            </div>
          )}
        </div>
      )}

      {phase !== "idle" && phase !== "done" && (
        <div className="mb-4 p-4 rounded-xl bg-violet-500/[0.08] border border-violet-500/25 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-violet-300 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-200">{PHASE_LABELS[phase]}</p>
            <p className="text-xs text-slate-300/70">Esto puede tomar unos segundos...</p>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-200">¡Tu tienda está lista! Redirigiendo...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 justify-between">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-5 py-3 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 hover:border-white/25 disabled:opacity-50 transition text-sm font-medium"
        >
          ← Atrás
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="px-7 py-3 rounded-xl bg-white text-[#05060f] font-semibold text-sm shadow-[0_0_28px_-4px_rgba(139,111,255,0.5)] hover:bg-[#b39bff] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {PHASE_LABELS[phase] || "Procesando..."}
            </>
          ) : (
            <>
              {hasImport ? "Crear tienda e importar" : "Crear mi tienda"}
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
