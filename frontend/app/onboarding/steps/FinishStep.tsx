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
      <h1 className="heading-page text-2xl mb-2">Resumen</h1>
      <p className="text-text-muted mb-6">
        Revisá todo y creá tu tienda
      </p>

      <div className="space-y-2 p-4 rounded-xl bg-white/5 mb-4">
        <p><span className="text-text-muted">Nombre:</span> {data.name}</p>
        <p><span className="text-text-muted">Slug:</span> {data.slug}</p>
        <p><span className="text-text-muted">Moneda:</span> {data.currency || "USD"}</p>
        <p><span className="text-text-muted">Plantilla:</span> {TEMPLATE_NAMES[data.template_id || "minimal"] ?? data.template_id}</p>
      </div>

      {hasImport && importInfo && (
        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 mb-6 space-y-2">
          <p className="text-sm font-semibold text-violet-300 mb-2">Importación programada</p>
          {importInfo.importProducts && importInfo.products.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Package className="w-4 h-4 text-violet-400" />
              <span>{importInfo.products.length} productos</span>
            </div>
          )}
          {importInfo.importDesign && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Palette className="w-4 h-4 text-violet-400" />
              <span>Diseño (colores, fuentes, logo)</span>
            </div>
          )}
          {importInfo.importSections && importInfo.sections.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Layout className="w-4 h-4 text-violet-400" />
              <span>{importInfo.sections.length} secciones</span>
            </div>
          )}
        </div>
      )}

      {phase !== "idle" && phase !== "done" && (
        <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-primary">{PHASE_LABELS[phase]}</p>
            <p className="text-xs text-text-muted">Esto puede tomar unos segundos...</p>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <p className="text-sm font-medium text-emerald-400">¡Tu tienda está lista! Redirigiendo...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Atrás
        </button>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-gradient-agentro px-6 py-3 rounded-xl font-semibold text-white hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {PHASE_LABELS[phase] || "Procesando..."}
            </>
          ) : (
            hasImport ? "Crear tienda e importar" : "Crear mi tienda"
          )}
        </button>
      </div>
    </div>
  );
}
