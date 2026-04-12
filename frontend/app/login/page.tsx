"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { getOnboardingStatus } from "@/lib/api/onboarding";
import { getGoogleAuthUrl } from "@/lib/auth";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/app";
  const oauthError = searchParams.get("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const status = await getOnboardingStatus();
      if (status.suggested_redirect === "/admin") {
        router.push("/admin");
      } else if (status.has_store) {
        router.push(redirectParam);
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass">
      <Link href="/" className="inline-block mb-6 hover:opacity-90 transition-opacity">
        <img src="/logo-white.png" alt="Agentro" className="h-7 w-auto" />
      </Link>
      <h1 className="heading-page text-2xl mb-2">Iniciar sesion</h1>
      <p className="text-text-muted text-sm mb-6">
        Accede a tu panel de Agentro
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {(error || oauthError) && (
          <div className={`p-3 rounded-lg text-sm ${
            oauthError === "google_not_configured"
              ? "bg-amber-500/10 text-amber-400"
              : "bg-red-500/10 text-red-400"
          }`}>
            {error ||
              (oauthError === "oauth_failed" ? "Error al iniciar sesion con Google" : "") ||
              (oauthError === "oauth_token_failed" ? "Error al intercambiar el codigo de Google. Verifica el redirect URI en Google Cloud Console." : "") ||
              (oauthError === "google_not_configured" ? "Google no esta configurado. Usa tu email y contrasena para entrar." : "")}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
            placeholder="tu@email.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Contrasena</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
            placeholder="••••••••"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-agentro py-3 rounded-lg font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-6">
        <a
          href={getGoogleAuthUrl("login")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-white/20 hover:bg-white/5 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Iniciar sesion con Google
        </a>
      </div>

      <p className="mt-6 text-center text-sm text-text-muted">
        No tenes cuenta?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Registrate
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background landing-bg flex items-center justify-center">
      <Suspense fallback={<div className="text-text-muted">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
