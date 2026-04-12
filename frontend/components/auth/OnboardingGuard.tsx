"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { useStore } from "@/lib/context/StoreContext";
import { getOnboardingStatus } from "@/lib/api/onboarding";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isLoading: storeLoading } = useStore();
  const [checking, setChecking] = useState(true);
  const [hasStore, setHasStore] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Esperar a que auth y stores terminen de cargar
    if (!user || storeLoading) return;

    getOnboardingStatus()
      .then((s) => {
        setHasStore(s.has_store);
        if (!s.has_store) {
          router.replace(s.suggested_redirect ?? "/onboarding");
        }
      })
      .catch(() => {
        setHasStore(false);
        router.replace("/login");
      })
      .finally(() => setChecking(false));
  }, [user, storeLoading, router]);

  if (!user || storeLoading || checking || !hasStore) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
