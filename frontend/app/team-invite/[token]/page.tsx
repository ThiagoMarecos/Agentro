"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  acceptInvitation,
  getInvitationInfo,
  type InvitationInfo,
} from "@/lib/api/team";

const ROLE_LABELS: Record<string, string> = {
  manager: "Gerente",
  seller: "Vendedor/a",
  support: "Soporte",
};

export default function TeamInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user, login, register } = useAuth();
  const token = params.token;

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Form state
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getInvitationInfo(token)
      .then((d) => {
        setInfo(d);
      })
      .catch((e) => setError(e.message || "Invitación no válida"))
      .finally(() => setLoading(false));
  }, [token]);

  const onAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setSubmitting(true);
    setError("");
    try {
      // Caso 1: el usuario YA tiene cuenta y está logueado → solo POST
      if (user && info.user_exists) {
        const r = await acceptInvitation(token, {});
        router.push(`/app?store=${r.store_id}&welcome=team`);
        return;
      }

      // Caso 2: usuario YA tiene cuenta pero NO está logueado → loguear primero
      if (info.user_exists) {
        if (!password || password.length < 6) {
          setError("Esta cuenta ya existe. Ingresá tu contraseña para asociarla a la tienda.");
          setSubmitting(false);
          return;
        }
        await login(info.email, password);
        const r = await acceptInvitation(token, {});
        router.push(`/app?store=${r.store_id}&welcome=team`);
        return;
      }

      // Caso 3: usuario nuevo → crear cuenta vía /accept (con password) y luego loguear
      if (!password || password.length < 6) {
        setError("Elegí una contraseña de al menos 6 caracteres.");
        setSubmitting(false);
        return;
      }
      await acceptInvitation(token, { full_name: fullName.trim() || undefined, password });
      // Login después de crear la cuenta
      await login(info.email, password);
      router.push(`/app?welcome=team`);
    } catch (e: any) {
      setError(e.message || "No pudimos aceptar la invitación");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="text-sm text-slate-300">Cargando invitación…</div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full">
          <h1 className="text-xl font-semibold text-white mb-2">Invitación no válida</h1>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            Ir a login
          </Link>
        </div>
      </div>
    );
  }

  if (!info) return null;

  const isLoggedInAsRightUser = user && user.email === info.email;
  const needsPasswordOnly = info.user_exists && !isLoggedInAsRightUser;
  const isCreatingAccount = !info.user_exists;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500" />
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Invitación</div>
            <div className="text-lg font-semibold text-white">{info.store_name}</div>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          {info.inviter_name && <>Te invitó <strong className="text-white">{info.inviter_name}</strong> a unirte a </>}
          <strong className="text-white">{info.store_name}</strong> como{" "}
          <strong className="text-indigo-400">{ROLE_LABELS[info.role] || info.role}</strong>.
        </p>

        <div className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 mb-6">
          <div className="text-xs text-slate-500">Email de la invitación</div>
          <div className="text-sm text-white">{info.email}</div>
        </div>

        <form onSubmit={onAccept} className="space-y-3">
          {isLoggedInAsRightUser ? (
            <div className="px-3 py-2 bg-emerald-900/40 border border-emerald-800 rounded-lg text-sm text-emerald-300">
              ✓ Estás logueado como <strong>{user.email}</strong>. Click en aceptar y listo.
            </div>
          ) : (
            <>
              {isCreatingAccount && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Tu nombre (opcional)</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  {needsPasswordOnly ? "Contraseña de tu cuenta" : "Elegí una contraseña"}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
          >
            {submitting ? "Procesando…" : "Aceptar invitación"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500 text-center">
          {info.expires_at && (
            <>Vence el {new Date(info.expires_at).toLocaleDateString("es-AR")}.{" "}</>
          )}
          ¿No esperabas esta invitación? Podés ignorarla.
        </p>
      </div>
    </div>
  );
}
