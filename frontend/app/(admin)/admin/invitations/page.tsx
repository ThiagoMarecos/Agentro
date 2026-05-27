"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  Search,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Loader2,
  Mail,
  Phone,
  Globe2,
  Building2,
  Sparkles,
  X,
  Save,
} from "lucide-react";
import {
  listInvitationRequests,
  updateInvitationRequest,
  type InvitationRequestAdminItem,
  type InvitationStatus,
} from "@/lib/api/invitations-admin";

/* ── helpers ─────────────────────────────────────────────── */

const BUSINESS_LABEL: Record<string, string> = {
  retail: "Retail / Moda",
  gastro: "Gastronomía",
  services: "Servicios",
  ecommerce: "E-commerce",
  other: "Otro",
};

const REFERRAL_LABEL: Record<string, string> = {
  google: "Google",
  ai: "Sugerencia de IA",
  recommendation: "Recomendación",
  social: "Redes sociales",
  ad: "Publicidad",
  press: "Prensa / nota",
  event: "Evento",
  other: "Otro",
};

const STATUS_META: Record<
  InvitationStatus,
  { label: string; cls: string; dot: string }
> = {
  pending:   { label: "Pendiente",  cls: "bg-amber-50 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  contacted: { label: "Contactado", cls: "bg-blue-50 text-blue-700 border-blue-200",        dot: "bg-blue-500" },
  approved:  { label: "Aprobado",   cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected:  { label: "Rechazado",  cls: "bg-rose-50 text-rose-700 border-rose-200",        dot: "bg-rose-500" },
};

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── component ───────────────────────────────────────────── */

const FILTERS: { v: InvitationStatus | "all"; label: string }[] = [
  { v: "all", label: "Todas" },
  { v: "pending", label: "Pendientes" },
  { v: "contacted", label: "Contactadas" },
  { v: "approved", label: "Aprobadas" },
  { v: "rejected", label: "Rechazadas" },
];

export default function InvitationsAdminPage() {
  const [items, setItems] = useState<InvitationRequestAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<InvitationStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InvitationRequestAdminItem | null>(null);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await listInvitationRequests({ limit: 500 });
      setItems(list);
    } catch (e: any) {
      setErr(e?.message || "No se pudo cargar la lista.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, contacted: 0, approved: 0, rejected: 0 };
    for (const it of items) {
      c[it.status] = (c[it.status] || 0) + 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.status !== filter) return false;
      if (!s) return true;
      return (
        it.email.toLowerCase().includes(s) ||
        it.full_name.toLowerCase().includes(s) ||
        it.business_name.toLowerCase().includes(s) ||
        (it.country || "").toLowerCase().includes(s)
      );
    });
  }, [items, filter, search]);

  const handleStatusChange = async (id: string, status: InvitationStatus) => {
    try {
      const updated = await updateInvitationRequest(id, { status });
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      if (selected?.id === id) setSelected(updated);
    } catch (e: any) {
      alert(e?.message || "Error al actualizar");
    }
  };

  const handleNotesSave = async (id: string, notes: string) => {
    try {
      const updated = await updateInvitationRequest(id, { notes });
      setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));
      if (selected?.id === id) setSelected(updated);
    } catch (e: any) {
      alert(e?.message || "Error al guardar notas");
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pedidos de invitación</h1>
            <p className="text-sm text-gray-500">
              Solicitudes recibidas desde el formulario público <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/request-invite</code>
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Recargar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map((f) => {
          const active = filter === f.v;
          const count = (counts as any)[f.v] ?? 0;
          return (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                active
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {f.label}
              <span className={`ml-2 text-xs ${active ? "text-violet-200" : "text-gray-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, negocio..."
            className="pl-9 pr-3 py-2 w-72 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Cargando solicitudes...
          </div>
        ) : err ? (
          <div className="p-12 text-center">
            <XCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <p className="text-sm text-rose-600">{err}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No hay solicitudes {filter !== "all" ? `con estado "${STATUS_META[filter as InvitationStatus].label.toLowerCase()}"` : ""}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Solicitante</th>
                <th className="px-5 py-3">Negocio</th>
                <th className="px-5 py-3">Origen</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Recibido</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const meta = STATUS_META[it.status] || STATUS_META.pending;
                return (
                  <tr
                    key={it.id}
                    onClick={() => setSelected(it)}
                    className="border-b border-gray-50 hover:bg-violet-50/30 cursor-pointer transition"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{it.full_name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[220px]">{it.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900 truncate max-w-[180px]">{it.business_name}</div>
                      <div className="text-xs text-gray-500">{BUSINESS_LABEL[it.business_type] || it.business_type}</div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {it.referral_source ? REFERRAL_LABEL[it.referral_source] || it.referral_source : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(it.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-300">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Drawer detalle */}
      {selected && (
        <DetailDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onChangeStatus={(s) => handleStatusChange(selected.id, s)}
          onSaveNotes={(n) => handleNotesSave(selected.id, n)}
        />
      )}
    </div>
  );
}

/* ── Drawer de detalle ───────────────────────────────────── */

function DetailDrawer({
  item,
  onClose,
  onChangeStatus,
  onSaveNotes,
}: {
  item: InvitationRequestAdminItem;
  onClose: () => void;
  onChangeStatus: (s: InvitationStatus) => void;
  onSaveNotes: (n: string) => void;
}) {
  const [notes, setNotes] = useState(item.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const meta = STATUS_META[item.status];

  useEffect(() => setNotes(item.notes || ""), [item.id, item.notes]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await onSaveNotes(notes);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="ml-auto relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-[slideIn_0.25s_cubic-bezier(0.2,0.8,0.2,1)] overflow-hidden">
        <style jsx>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Solicitud</div>
            <h2 className="text-lg font-bold text-gray-900">{item.full_name}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status pill + actions */}
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Estado</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${meta.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              {item.approved_at && (
                <span className="text-xs text-gray-400">
                  Aprobado: {formatFullDate(item.approved_at)}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => onChangeStatus("contacted")}
                disabled={item.status === "contacted"}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4" />
                Marcar contactado
              </button>
              <button
                onClick={() => onChangeStatus("approved")}
                disabled={item.status === "approved"}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                Aprobar
              </button>
              <button
                onClick={() => onChangeStatus("pending")}
                disabled={item.status === "pending"}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="w-4 h-4" />
                Volver a pendiente
              </button>
              <button
                onClick={() => onChangeStatus("rejected")}
                disabled={item.status === "rejected"}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium hover:bg-rose-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                Rechazar
              </button>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Contacto</div>
            <div className="space-y-2">
              <a href={`mailto:${item.email}`} className="flex items-center gap-2 text-sm text-violet-600 hover:underline">
                <Mail className="w-4 h-4" />
                {item.email}
              </a>
              {item.whatsapp && (
                <a
                  href={`https://wa.me/${item.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-600 hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  {item.whatsapp}
                </a>
              )}
              {item.country && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe2 className="w-4 h-4" />
                  {item.country}
                </div>
              )}
            </div>
          </div>

          {/* Negocio */}
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Negocio</div>
            <div className="flex items-start gap-2 text-sm text-gray-700">
              <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">{item.business_name}</div>
                <div className="text-xs text-gray-500">{BUSINESS_LABEL[item.business_type] || item.business_type}</div>
              </div>
            </div>
          </div>

          {/* Origen */}
          {item.referral_source && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Cómo nos encontró</div>
              <div className="text-sm text-gray-900">{REFERRAL_LABEL[item.referral_source] || item.referral_source}</div>
              {item.referral_detail && (
                <div className="text-sm text-gray-600 mt-1 italic">"{item.referral_detail}"</div>
              )}
            </div>
          )}

          {/* Expectations */}
          {item.expectations && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Qué espera de Agentro</div>
              <div className="text-sm text-gray-700 bg-violet-50/40 border border-violet-100 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {item.expectations}
              </div>
            </div>
          )}

          {/* Notas internas */}
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notas internas</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tus notas privadas sobre este pedido..."
              rows={4}
              className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes || notes === (item.notes || "")}
              className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar notas
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-4">
            Recibido el {formatFullDate(item.created_at)}
            {" · "}
            Acepta contacto: {item.accepts_contact ? "sí" : "no"}
          </div>
        </div>
      </div>
    </div>
  );
}
