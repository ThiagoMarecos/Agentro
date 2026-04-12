"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Package,
  ShoppingCart,
  Users,
  Power,
  Globe,
  Mail,
  Phone,
  Calendar,
  Tag,
  ShieldBan,
} from "lucide-react";
import {
  getAdminStoreDetail,
  updateStoreStatus,
  getStoreActivity,
  StoreDetail,
  ActivityItem,
} from "@/lib/api/admin";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900">{value || "-"}</p>
      </div>
    </div>
  );
}

function CountCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  const colorMap: Record<string, string> = {
    violet: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.violet}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminStoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    Promise.all([
      getAdminStoreDetail(storeId),
      getStoreActivity(storeId),
    ])
      .then(([s, a]) => { setStore(s); setActivity(a); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [storeId]);

  const handleToggle = async () => {
    if (!store) return;
    setActionLoading(true);
    try {
      await updateStoreStatus(store.id, !store.is_active);
      const updated = await getAdminStoreDetail(store.id);
      setStore(updated);
      const acts = await getStoreActivity(store.id);
      setActivity(acts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const actionLabels: Record<string, string> = {
    store_activated: "Tienda activada",
    store_suspended: "Tienda suspendida",
    product_created: "Producto creado",
    product_updated: "Producto actualizado",
    order_created: "Pedido creado",
    whatsapp_connected: "WhatsApp conectado",
    whatsapp_disconnected: "WhatsApp desconectado",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Cargando detalle...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/admin/stores" className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
      </div>
    );
  }

  if (!store) return null;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/stores" className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 mb-3">
            <ArrowLeft className="w-4 h-4" /> Volver a tiendas
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
              <p className="text-sm text-gray-400">{store.slug}.nexora.com</p>
            </div>
            {store.is_active ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Activa
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                <XCircle className="w-3 h-3" /> Suspendida
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={actionLoading}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            store.is_active
              ? "bg-red-50 text-red-600 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
          }`}
        >
          <Power className="w-4 h-4" />
          {actionLoading ? "Procesando..." : store.is_active ? "Suspender tienda" : "Activar tienda"}
        </button>
      </div>

      {/* Suspension banner */}
      {!store.is_active && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-5 flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <ShieldBan className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-800">Tienda suspendida por el administrador</h3>
            <p className="text-sm text-amber-700 mt-1">
              Esta tienda ha sido suspendida por tiempo indefinido. Los clientes no pueden acceder a la tienda y el propietario
              no puede realizar operaciones. Para reactivarla, usá el botón "Activar tienda".
            </p>
          </div>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CountCard label="Productos" value={store.product_count} icon={Package} color="violet" />
        <CountCard label="Pedidos" value={store.order_count} icon={ShoppingCart} color="blue" />
        <CountCard label="Clientes" value={store.customer_count} icon={Users} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store info */}
        <div className="bg-white rounded-xl border border-gray-200/60 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Información general</h2>
          <div className="space-y-1">
            <InfoRow icon={Mail} label="Propietario" value={store.owner_email} />
            <InfoRow icon={Tag} label="Industria" value={store.industry} />
            <InfoRow icon={Globe} label="País" value={store.country} />
            <InfoRow icon={Calendar} label="Fecha de creación" value={formatDate(store.created_at)} />
            {store.description && <InfoRow icon={Building2} label="Descripción" value={store.description} />}
          </div>
        </div>

        {/* WhatsApp status */}
        <div className="bg-white rounded-xl border border-gray-200/60 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">WhatsApp</h2>
          {store.whatsapp_status ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  ["open", "connected"].includes(store.whatsapp_status) ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
                }`}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {["open", "connected"].includes(store.whatsapp_status) ? "Conectado" : store.whatsapp_status === "connecting" ? "Conectando..." : "Desconectado"}
                  </p>
                  {store.whatsapp_number && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {store.whatsapp_number}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-gray-400">
              <MessageSquare className="w-5 h-5" />
              <p className="text-sm">No configurado</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity log */}
      <div className="bg-white rounded-xl border border-gray-200/60">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Actividad reciente</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              No hay actividad registrada
            </div>
          ) : (
            activity.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-900">
                    {actionLabels[item.action] || item.action}
                  </p>
                  {item.details && <p className="text-xs text-gray-400 mt-0.5">{item.details}</p>}
                  {item.user_email && <p className="text-xs text-gray-400">por {item.user_email}</p>}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">
                  {formatDateTime(item.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
