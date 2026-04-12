"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { getOrder, updateOrderStatus } from "@/lib/api/stores";
import {
  ArrowLeft,
  Package,
  User,
  MapPin,
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  Box,
} from "lucide-react";
import { formatPrice } from "@/lib/utils/formatPrice";

interface OrderItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit_price: string;
  total_price: string;
}

interface OrderCustomer {
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface OrderAddress {
  address_line1: string;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  subtotal: string;
  tax_amount: string;
  shipping_amount: string;
  discount_amount: string;
  total: string;
  currency: string;
  notes: string | null;
  created_at: string | null;
  items: OrderItem[];
  customer: OrderCustomer | null;
  address: OrderAddress | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Clock },
  confirmed: { label: "Confirmado", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: CheckCircle2 },
  processing: { label: "En preparación", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", icon: Box },
  shipped: { label: "Enviado", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", icon: Truck },
  delivered: { label: "Entregado", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: XCircle },
};

const STATUS_FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentStore } = useStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!currentStore || !id) return;
    setLoading(true);
    getOrder(currentStore.id, id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [currentStore, id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!currentStore || !id || updating) return;
    setUpdating(true);
    try {
      await updateOrderStatus(currentStore.id, id, newStatus);
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
      const label = STATUS_CONFIG[newStatus]?.label || newStatus;
      showToast(`Estado actualizado a "${label}"`);
    } catch {
      showToast("Error al actualizar estado", "error");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
          <div className="flex-1">
            <div className="h-6 w-48 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-4 w-32 bg-gray-50 rounded animate-pulse" />
          </div>
          <div className="h-8 w-28 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200/60 p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200/60 p-5 h-48 animate-pulse bg-gray-50" />
            <div className="bg-white rounded-xl border border-gray-200/60 p-5 h-32 animate-pulse bg-gray-50" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Pedido no encontrado</p>
        <button onClick={() => router.push("/app/orders")} className="mt-4 text-indigo-600 text-sm hover:underline">
          Volver a pedidos
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const createdDate = order.created_at ? new Date(order.created_at).toLocaleString("es-AR") : "—";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/app/orders")}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-gray-900">
            Pedido {order.order_number}
          </h1>
          <p className="text-sm text-gray-400">{createdDate}</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${statusCfg.bg}`}>
          <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
          <span className={`text-sm font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Productos */}
          <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Productos ({order.items.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {order.items.map((item) => (
                <div key={item.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    {item.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-700">
                      {item.quantity} × {formatPrice(Number(item.unit_price), order.currency || currentStore?.currency)}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(Number(item.total_price), order.currency || currentStore?.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Totales */}
            <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatPrice(Number(order.subtotal), order.currency || currentStore?.currency)}</span>
              </div>
              {Number(order.tax_amount) > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Impuestos</span>
                  <span>{formatPrice(Number(order.tax_amount), order.currency || currentStore?.currency)}</span>
                </div>
              )}
              {Number(order.shipping_amount) > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Envío</span>
                  <span>{formatPrice(Number(order.shipping_amount), order.currency || currentStore?.currency)}</span>
                </div>
              )}
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descuento</span>
                  <span>-{formatPrice(Number(order.discount_amount), order.currency || currentStore?.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatPrice(Number(order.total), order.currency || currentStore?.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {order.notes && (
            <div className="bg-white rounded-xl border border-gray-200/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Notas del cliente</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          {/* Cambiar estado */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Cambiar estado</h2>
            <div className="space-y-2">
              {STATUS_FLOW.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                const isCurrent = order.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={isCurrent || updating}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                      isCurrent
                        ? `${cfg.bg} border font-medium ${cfg.color}`
                        : "hover:bg-gray-50 text-gray-600 border border-transparent"
                    } disabled:opacity-60`}
                  >
                    <Icon className={`w-4 h-4 ${isCurrent ? cfg.color : "text-gray-400"}`} />
                    {cfg.label}
                    {isCurrent && <span className="ml-auto text-xs opacity-70">Actual</span>}
                  </button>
                );
              })}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={order.status === "cancelled" || updating}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                    order.status === "cancelled"
                      ? "bg-red-50 border border-red-200 text-red-700 font-medium"
                      : "hover:bg-red-50 text-red-600 border border-transparent"
                  } disabled:opacity-60`}
                >
                  <XCircle className={`w-4 h-4 ${order.status === "cancelled" ? "text-red-700" : "text-red-400"}`} />
                  Cancelar pedido
                  {order.status === "cancelled" && <span className="ml-auto text-xs opacity-70">Actual</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Cliente */}
          {order.customer && (
            <div className="bg-white rounded-xl border border-gray-200/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Cliente</h2>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-900 font-medium">
                  {order.customer.first_name} {order.customer.last_name}
                </p>
                <p className="text-gray-500">{order.customer.email}</p>
                {order.customer.phone && <p className="text-gray-500">{order.customer.phone}</p>}
              </div>
            </div>
          )}

          {/* Dirección */}
          {order.address && (
            <div className="bg-white rounded-xl border border-gray-200/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Dirección de envío</h2>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{order.address.address_line1}</p>
                <p>
                  {order.address.city}
                  {order.address.state ? `, ${order.address.state}` : ""}
                </p>
                {order.address.postal_code && <p>CP: {order.address.postal_code}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
