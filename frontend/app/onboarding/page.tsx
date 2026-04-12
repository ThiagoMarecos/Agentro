"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { getOnboardingStatus } from "@/lib/api/onboarding";
import { WelcomeStep } from "./steps/WelcomeStep";
import { SourceStep } from "./steps/SourceStep";
import { ImportUrlStep } from "./steps/ImportUrlStep";
import { ImportPreviewStep, type ImportSelections } from "./steps/ImportPreviewStep";
import { StoreDetailsStep } from "./steps/StoreDetailsStep";
import { BusinessDetailsStep } from "./steps/BusinessDetailsStep";
import { TemplateStep } from "./steps/TemplateStep";
import { FinishStep } from "./steps/FinishStep";
import type { AnalyzeResponse } from "@/lib/api/import";

type Step = "welcome" | "source" | "import_url" | "import_preview" | "store" | "business" | "template" | "finish";

export interface OnboardingFormData {
  name: string;
  slug: string;
  industry?: string;
  country?: string;
  currency?: string;
  language?: string;
  template_id?: string;
  importData?: ImportSelections;
}

export default function OnboardingPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(true);
  const [hasStore, setHasStore] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: "",
    slug: "",
    industry: "",
    country: "US",
    currency: "USD",
    language: "es",
    template_id: "minimal",
  });
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?redirect=/onboarding");
      return;
    }
    if (!user) return;

    getOnboardingStatus()
      .then((s) => {
        setHasStore(s.has_store);
        // Allow users with stores to still create new ones via onboarding
        // Only block if they were NOT intentionally navigating here
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const updateFormData = useCallback((updates: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-pulse text-text-muted">Cargando...</div>
      </div>
    );
  }

  const FLOW_NEW: Step[] = ["welcome", "source", "store", "business", "template", "finish"];
  const FLOW_IMPORT: Step[] = ["welcome", "source", "import_url", "import_preview", "store", "business", "template", "finish"];
  const hasImportData = !!formData.importData;
  const currentFlow = hasImportData || step === "import_url" || step === "import_preview" ? FLOW_IMPORT : FLOW_NEW;

  const stepIndex = currentFlow.indexOf(step);
  const totalSteps = currentFlow.length;
  const progress = stepIndex / (totalSteps - 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
      <div className="mb-8 flex gap-2">
        {currentFlow.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded transition-colors ${
              i <= stepIndex ? "bg-primary" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {step === "welcome" && (
        <WelcomeStep onNext={() => setStep("source")} />
      )}

      {step === "source" && (
        <SourceStep
          onNext={() => setStep("store")}
          onImport={() => setStep("import_url")}
        />
      )}

      {step === "import_url" && (
        <ImportUrlStep
          onNext={(result) => {
            setAnalyzeResult(result);
            if (result.store_name) {
              updateFormData({ name: result.store_name });
            }
            setStep("import_preview");
          }}
          onBack={() => setStep("source")}
          onSkip={() => setStep("store")}
        />
      )}

      {step === "import_preview" && analyzeResult && (
        <ImportPreviewStep
          data={analyzeResult}
          onNext={(selections) => {
            updateFormData({ importData: selections });
            setStep("store");
          }}
          onBack={() => setStep("import_url")}
        />
      )}

      {step === "store" && (
        <StoreDetailsStep
          onNext={() => setStep("business")}
          onBack={() => setStep(hasImportData ? "import_preview" : "source")}
          data={formData}
          setData={updateFormData}
        />
      )}

      {step === "business" && (
        <BusinessDetailsStep
          onNext={() => setStep("template")}
          onBack={() => setStep("store")}
          data={formData}
          setData={updateFormData}
        />
      )}

      {step === "template" && (
        <TemplateStep
          onNext={() => setStep("finish")}
          onBack={() => setStep("business")}
          data={formData}
          setData={updateFormData}
        />
      )}

      {step === "finish" && (
        <FinishStep
          onBack={() => setStep("template")}
          data={formData}
        />
      )}
    </div>
  );
}
