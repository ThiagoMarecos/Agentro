"use client";

/**
 * /admin/discounts — Super admin: gestión de descuentos SaaS.
 *
 * Permite aplicar descuentos manuales a stores específicas (friends & family,
 * embajadores, apologies, cierres de enterprise). Crea un Stripe Coupon + lo
 * aplica al Customer. El motivo es OBLIGATORIO para auditoría futura.
 */

import { useEffect, useState } from "react";
import {
  Tag,
  Plus,
  X,
  Trash2,
  Check,
  AlertCircle,
  Calendar,
  Percent,
  DollarSign,
  Clock,
  ShieldCheck,
  Filter,
} from "lucide-react";
import {
  listDiscounts,
  applyDiscount,
  cancelDiscount,
  formatDiscount,
  type Discount,
  type DiscountStatus,
  type ApplyDiscountPayload,
} from "@/lib/api/admin-discounts";


const STATUS_LABELS: Record<DiscountStatus, string> = {
  active: "Activo",
  canceled: "Cancelado",
  expired: "Expirado",
};

const STATUS_COLORS: Record<DiscountStatus, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  canceled: "bg-gray-100 text-gray-500 border-gray-200",
  expired: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function AdminDiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<DiscountStatus | "all">("all");
  const [applyOpen, setApplyOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const list = await listDiscounts(
        statusFilter !== "all" ? { status: statusFilter } : undefined,
      );
      setDiscounts(list);
      setError("");
    } catch (e: any) {
      setError(e.message || "Error cargando descuentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const onCancel = async (discountId: string, reason: string) => {
    if (!confirm(`¿Cancelar este descuento?\n\nMotivo: ${reason}\n\nEl próximo cobro vuelve al precio full.`)) return;
    try {
      await cancelDiscount(discountId);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error cancelando descuento");
    }
  };

  const activeCount = discounts.filter((d) => d.status === "active").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-indigo-600" />
            Descuentos SaaS
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Aplicá descuentos manuales a la suscripción de stores específicas.
            Cada descuento crea un Stripe Coupon. Motivo obligatorio.
          </p>
        </div>
        <button
          onClick={() => setApplyOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Aplicar descuento
        </button>
      </div>

      {/* Filtros + stats */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(["all", "active", "canceled", "expired"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                statusFilter === s
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "Todos" : STATUS_LABELS[s as DiscountStatus]}
            </button>
          ))}
        </div>
        <div className="text-xs text-gray-500">
          <strong>{activeCount}</strong> activo{activeCount === 1 ? "" : "s"} de{" "}
          <strong>{discounts.length}</strong> total
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando descuentos…</div>
      ) : discounts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <Tag className="w-12 h-12 mx-auto text-gray-300" />
          <h3 className="mt-4 text-gray-700 font-semibold">Sin descuentos</h3>
          <p className="mt-1 text-sm text-gray-500">
            Aplicá uno cuando quieras premiar a un cliente o cerrar un trato.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Store</th>
                <th className="text-left px-4 py-3 font-medium">Descuento</th>
                <th className="text-left px-4 py-3 font-medium">Motivo</th>
                <th className="text-left px-4 py-3 font-medium">Aplicado por</th>
                <th className="text-left px-4 py-3 font-medium">Cuándo</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">{d.store_name ?? "—"}</div>
                    <div className="text-xs text-gray-400">{d.store_slug ?? d.store_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1 text-sm font-medium text-gray-900">
                      {d.discount_type === "percent" ? (
                        <Percent className="w-3.5 h-3.5 text-indigo-500" />
                      ) : (
                        <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                      )}
                      {formatDiscount(d)}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-sm text-gray-700 truncate" title={d.reason}>
                      {d.reason}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {d.applied_by_email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(d.created_at).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[d.status]}`}
                    >
                      {STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status === "active" && (
                      <button
                        onClick={() => onCancel(d.id, d.reason)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Cancelar descuento"
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
      )}

      {applyOpen && (
        <ApplyDiscountModal
          onClose={() => setApplyOpen(false)}
          onCreated={async () => {
            setApplyOpen(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}


function ApplyDiscountModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [storeId, setStoreId] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState(20);
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [durationMonths, setDurationMonths] = useState(3);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload: ApplyDiscountPayload = {
        store_id: storeId.trim(),
        discount_type: discountType,
        discount_value: discountType === "percent" ? discountValue : Math.round(discountValue * 100),
        duration,
        duration_in_months: duration === "repeating" ? durationMonths : null,
        reason: reason.trim(),
      };
      await applyDiscount(payload);
      onCreated();
    } catch (e: any) {
      setError(e.message || "Error aplicando descuento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Aplicar descuento</h3>
            <p className="text-xs text-gray-500 mt-1">
              Crea un Stripe Coupon y lo aplica al Customer de la store.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Store ID */}
          <div>
            <label className="block text-xs text-gray-600 mb-1.5 font-medium">
              Store ID o slug
            </label>
            <input
              type="text"
              required
              autoFocus
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              placeholder="store-slug-o-uuid"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Tip: copiá el ID desde /admin/stores
            </p>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs text-gray-600 mb-1.5 font-medium">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType("percent")}
                className={`px-3 py-2 rounded-lg text-sm border flex items-center justify-center gap-2 ${
                  discountType === "percent"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Percent className="w-4 h-4" />
                Porcentaje
              </button>
              <button
                type="button"
                onClick={() => setDiscountType("amount")}
                className={`px-3 py-2 rounded-lg text-sm border flex items-center justify-center gap-2 ${
                  discountType === "amount"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Monto fijo
              </button>
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="block text-xs text-gray-600 mb-1.5 font-medium">
              {discountType === "percent" ? "Porcentaje off (1-100)" : "Monto en USD"}
            </label>
            <div className="relative">
              <input
                type="number"
                required
                min={discountType === "percent" ? 1 : 0.01}
                max={discountType === "percent" ? 100 : undefined}
                step={discountType === "percent" ? 1 : 0.01}
                value={discountValue}
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 pr-10 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                {discountType === "percent" ? "%" : "$"}
              </span>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs text-gray-600 mb-1.5 font-medium">Duración</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: "once", label: "Una vez" },
                { val: "repeating", label: "X meses" },
                { val: "forever", label: "Para siempre" },
              ] as const).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDuration(opt.val)}
                  className={`px-3 py-2 rounded-lg text-xs border ${
                    duration === opt.val
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {duration === "repeating" && (
              <input
                type="number"
                min={1}
                max={36}
                value={durationMonths}
                onChange={(e) => setDurationMonths(parseInt(e.target.value) || 1)}
                className="mt-2 w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="Cantidad de meses"
              />
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs text-gray-600 mb-1.5 font-medium">
              Motivo (obligatorio para auditoría)
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Early adopter cierre de Pro anual / Apology por downtime del 25/06 / Friends & family Juan Pérez"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              Vas a leer esto en 6 meses para entender por qué le pusiste descuento. Sé específico.
            </p>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

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
              disabled={submitting || !storeId.trim() || !reason.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" /> Aplicando…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> Aplicar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
