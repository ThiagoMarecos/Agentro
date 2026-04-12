"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setTokens } from "@/lib/auth";
import { getOnboardingStatus } from "@/lib/api/onboarding";
import { useAuth } from "@/app/providers/AuthProvider";

function parseTokensFromUrl(): { access: string; refresh: string } | null {
  if (typeof window === "undefined") return null;
  // Prioridad: fragment (hash) - tokens no se envían al servidor
  const hash = window.location.hash?.slice(1);
  if (hash) {
    const params = new URLSearchParams(hash);
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    if (access && refresh) return { access, refresh };
  }
  // Fallback: query (compatibilidad)
  const params = new URLSearchParams(window.location.search);
  const access = params.get("access_token");
  const refresh = params.get("refresh_token");
  if (access && refresh) return { access, refresh };
  return null;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { reloadUser } = useAuth();

  useEffect(() => {
    const tokens = parseTokensFromUrl();
    if (!tokens) {
      router.replace("/login?error=oauth_failed");
      return;
    }

    const run = async () => {
      setTokens(tokens.access, tokens.refresh);
      await reloadUser();
      try {
        const status = await getOnboardingStatus();
        if (status.suggested_redirect === "/admin") {
          router.replace("/admin");
        } else if (status.has_store) {
          router.replace("/app");
        } else {
          router.replace("/onboarding");
        }
      } catch {
        router.replace("/app");
      }
    };
    run();
  }, [router, reloadUser]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-text-muted">Completando inicio de sesión...</div>
    </div>
  );
}
