"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { getOrders, updateOrderStatus } from "@/lib/api/stores";
import { formatPrice } from "@/lib/utils/formatPrice";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Box,
  ChevronRight,
  Search,
  X,
  Filter,
  Package,
  DollarSign,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */
interface Order {
  id: string;
  order_number: string;
  status: string;
  total: string;
  subtotal?: string;
  currency?: string;
  created_at?: string;
  customer_id?: string;
}

/* ── Status config ─────────────────────────────────── */
const STATUS_MAP: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pendiente",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmado",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: CheckCircle2,
  },
  processing: {
    label: "En preparacion",
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    icon: Box,
  },
  shipped: {
    label: "Enviado",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: Truck,
  },
  delivered: {
    label: "Entregado",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: XCircle,
  },
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "pending", label: "Pendientes" },
  { value: "confirmed", label: "Confirmados" },
  { value: "processing", label: "En preparacion" },
  { value: "shipped", label: "Enviados" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
];

/* ── Skeleton row ──────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse" />
          <div>
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-1.5" />
            <div className="h-3 w-16 bg-gray-50 rounded animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="h-6 w-24 bg-gray-100 rounded-full animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
      </td>
      <td className="px-3 py-4">
        <div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />
      </td>
    </tr>
  );
}

/* ── Quick status change dropdown ──────────────────── */
function StatusDropdown({
  currentStatus,
  onChangeStatus,
}: {
  currentStatus: string;
  onChangeStatus: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_MAP[currentStatus] || STATUS_MAP.pending;
  const Icon = cfg.icon;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${cfg.bg} ${cfg.color} ${cfg.border} hover:shadow-sm`}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200/60 py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
            {Object.entries(STATUS_MAP).map(([key, val]) => {
              const StatusIcon = val.icon;
              const isCurrent = key === currentStatus;
              return (
                <button
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isCurrent) onChangeStatus(key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition ${
                    isCurrent
                      ? `${val.bg} ${val.color} font-medium`
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <StatusIcon className={`w-3.5 h-3.5 ${isCurrent ? val.color : "text-gray-400"}`} />
                  {val.label}
                  {isCurrent && (
                    <span className="ml-auto text-xs opacity-60">Actual</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────── */
export default function OrdersPage() {
  const { currentStore } = useStore();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    setError("");
    try {
      const data = await getOrders(currentStore.id);
      setOrders(data);
    } catch {
      setOrders([]);
      setError("Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!currentStore) return;
    try {
      await updateOrderStatus(currentStore.id, orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      const label = STATUS_MAP[newStatus]?.label || newStatus;
      showToast(`Pedido actualizado a "${label}"`);
    } catch {
      showToast("Error al actualizar estado", "error");
    }
  };

  /* ── Filtered & searched ── */
  const filtered = orders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !o.order_number.toLowerCase().includes(q) &&
        !o.status.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  /* ── Stats ── */
  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const shippedCount = orders.filter((o) => o.status === "shipped" || o.status === "delivered").length;
  const activeFilters = [search, statusFilter].filter(Boolean).length;

  const currency = currentStore?.currency || "USD";

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Selecciona una tienda para ver los pedidos
      </div>
    );
  }

  return (
    <div>
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading
              ? "Cargando..."
              : orders.length > 0
              ? `${orders.length} pedido${orders.length !== 1 ? "s" : ""} en tu tienda`
              : "Los pedidos de tu tienda apareceran aca"}
          </p>
        </div>
      </div>

      {/* ── Stats cards ── */}
      {!loading && orders.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{orders.length}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs text-gray-400">Pendientes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{shippedCount}</p>
              <p className="text-xs text-gray-400">Enviados/Entregados</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 truncate max-w-[120px]" title={formatPrice(totalRevenue, currency)}>
                {formatPrice(totalRevenue, currency)}
              </p>
              <p className="text-xs text-gray-400">Ingresos</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search + filter bar ── */}
      {!loading && orders.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por numero de pedido..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Clear filters */}
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        /* Skeleton */
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pedido</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : orders.length === 0 ? (
        /* Empty state — no orders at all */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
            <ShoppingBag className="w-7 h-7 text-indigo-400" />
          </div>
          <h3 className="font-display font-semibold text-gray-900 text-lg mb-1.5">
            No hay pedidos todavia
          </h3>
          <p className="text-sm text-gray-400 max-w-sm">
            Cuando tus clientes realicen compras en tu tienda, los pedidos apareceran automaticamente aca para que puedas gestionarlos.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state — filter has no results */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="font-display font-semibold text-gray-900 mb-1">Sin resultados</h3>
          <p className="text-sm text-gray-400 mb-4">
            No se encontraron pedidos con los filtros actuales
          </p>
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        /* Data table */
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Pedido
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden sm:table-cell">
                  Fecha
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Total
                </th>
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const date = order.created_at
                  ? new Date(order.created_at).toLocaleDateString("es-PY", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—";

                const timeAgo = order.created_at ? getTimeAgo(new Date(order.created_at)) : "";

                return (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/app/orders/${order.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors cursor-pointer group"
                  >
                    {/* Order number + date hint */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-900">
                            {order.order_number}
                          </span>
                          {timeAgo && (
                            <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status — clickable dropdown */}
                    <td className="px-5 py-4">
                      <StatusDropdown
                        currentStatus={order.status}
                        onChangeStatus={(s) => handleStatusChange(order.id, s)}
                      />
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 text-sm text-gray-500 hidden sm:table-cell">
                      {date}
                    </td>

                    {/* Total */}
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatPrice(Number(order.total), currency)}
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="px-3 py-4">
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer — count */}
          {filtered.length !== orders.length && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 text-xs text-gray-400">
              Mostrando {filtered.length} de {orders.length} pedidos
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helper: human-readable time ago ── */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Justo ahora";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
  return "";
}
