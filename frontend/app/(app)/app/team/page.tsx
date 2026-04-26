"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import {
  listTeamMembers,
  listInvitations,
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  type TeamMember,
  type Invitation,
  type AssignableRole,
} from "@/lib/api/team";
import { Mail, Trash2, X, Plus, Copy, Check, ShieldCheck, ShieldHalf, User as UserIcon } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueño/a",
  admin: "Admin",
  manager: "Gerente",
  support: "Soporte",
  seller: "Vendedor/a",
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-violet-100 text-violet-700",
  admin: "bg-indigo-100 text-indigo-700",
  manager: "bg-blue-100 text-blue-700",
  support: "bg-emerald-100 text-emerald-700",
  seller: "bg-amber-100 text-amber-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  expired: "Vencida",
  revoked: "Revocada",
};

export default function TeamPage() {
  const { currentStore } = useStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const reload = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        listTeamMembers(currentStore.id),
        listInvitations(currentStore.id),
      ]);
      setMembers(m);
      setInvitations(i);
      setError("");
    } catch (e: any) {
      setError(e.message || "Error cargando equipo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const onChangeRole = async (memberId: string, role: AssignableRole) => {
    if (!currentStore) return;
    try {
      await updateMemberRole(currentStore.id, memberId, role);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error cambiando rol");
    }
  };

  const onRemove = async (memberId: string, name: string) => {
    if (!currentStore) return;
    if (!confirm(`¿Quitar a ${name} del equipo?`)) return;
    try {
      await removeMember(currentStore.id, memberId);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error quitando miembro");
    }
  };

  const onRevokeInvitation = async (id: string) => {
    if (!currentStore) return;
    if (!confirm("¿Revocar esta invitación?")) return;
    try {
      await revokeInvitation(currentStore.id, id);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error revocando invitación");
    }
  };

  if (loading) return <div className="py-12 text-center text-gray-400">Cargando equipo…</div>;

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <div>
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Equipo</h1>
          <p className="text-gray-400 text-sm mt-1">
            Invitá vendedores y gerentes para que ayuden a manejar la tienda. Cada uno
            verá lo que su rol le permite.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Invitar miembro
        </button>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Members */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Miembros ({members.length})
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Persona</th>
                <th className="text-left px-4 py-3 font-medium">Rol</th>
                <th className="text-left px-4 py-3 font-medium">Se unió</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white grid place-items-center text-xs font-semibold">
                          {(m.full_name || m.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {m.full_name || m.email.split("@")[0]}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {m.role === "owner" ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[m.role] || "bg-gray-100 text-gray-700"}`}>
                        <ShieldCheck className="w-3 h-3" />
                        {ROLE_LABELS[m.role]}
                      </span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => onChangeRole(m.id, e.target.value as AssignableRole)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-700"
                      >
                        <option value="manager">Gerente</option>
                        <option value="support">Soporte</option>
                        <option value="seller">Vendedor/a</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(m.joined_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== "owner" && (
                      <button
                        onClick={() => onRemove(m.id, m.full_name || m.email)}
                        className="text-gray-400 hover:text-red-600 transition"
                        title="Quitar miembro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Invitaciones pendientes ({pendingInvitations.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Rol invitado</th>
                  <th className="text-left px-4 py-3 font-medium">Vence</th>
                  <th className="text-left px-4 py-3 font-medium">Invitado por</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {inv.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[inv.role] || "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[inv.role] || inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(inv.expires_at).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {inv.invited_by_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRevokeInvitation(inv.id)}
                        className="text-gray-400 hover:text-red-600 transition"
                        title="Revocar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal de invitación */}
      {inviteOpen && currentStore && (
        <InviteModal
          storeId={currentStore.id}
          onClose={() => setInviteOpen(false)}
          onCreated={async () => {
            setInviteOpen(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}


function InviteModal({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("seller");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdInvite, setCreatedInvite] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const inv = await createInvitation(storeId, email.trim(), role);
      setCreatedInvite(inv);
    } catch (e: any) {
      setError(e.message || "Error creando invitación");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!createdInvite?.accept_url) return;
    await navigator.clipboard.writeText(createdInvite.accept_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Invitar miembro</h3>
            <p className="text-sm text-gray-500 mt-1">
              Le mandamos un email con el link para que cree su cuenta.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdInvite ? (
          <div className="space-y-4">
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
              ✓ Invitación enviada a <strong>{createdInvite.email}</strong> como{" "}
              <strong>{ROLE_LABELS[createdInvite.role]}</strong>.
            </div>
            {createdInvite.accept_url && (
              <div>
                <div className="text-xs text-gray-500 mb-1.5">
                  O compartí el link directamente (vence en 7 días):
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={createdInvite.accept_url}
                    className="flex-1 text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-gray-700"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 bg-gray-900 text-white rounded text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={onCreated}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendedor@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Rol</label>
              <div className="grid grid-cols-3 gap-2">
                {(["seller", "support", "manager"] as AssignableRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                      role === r
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {role === "seller" && "Solo ve los chats que le asignen + sus métricas."}
                {role === "support" && "Ve todos los chats, sin gestión de productos ni equipo."}
                {role === "manager" && "Casi todo lo del dueño excepto billing y eliminar la tienda."}
              </div>
            </div>
            {error && <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                {submitting ? "Enviando…" : "Enviar invitación"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
