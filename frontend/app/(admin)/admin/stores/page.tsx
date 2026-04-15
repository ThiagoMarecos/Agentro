"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  Power,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getAdminStores,
  updateStoreStatus,
  StoreListItem,
  StoreListResponse,
} from "@/lib/api/admin";

export default function AdminStoresPage() {
  const router = useRouter();
  const [data, setData] = useState<StoreListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pageSize = 15;

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminStores({ page, page_size: pageSize, search, status: statusFilter });
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const handleToggleStatus = async (store: StoreListItem) => {
    setActionLoading(store.id);
    try {
      await updateStoreStatus(store.id, !store.is_active);
      await fetchStores();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tiendas</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de todas las tiendas de la plataforma</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                statusFilter === s
                  ? "bg-violet-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "all" ? "Todas" : s === "active" ? "Activas" : "Suspendidas"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tienda</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Propietario</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">WhatsApp</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Fecha</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="animate-pulse text-gray-400 text-sm">Cargando tiendas...</div>
                  </td>
                </tr>
              ) : data && data.stores.length > 0 ? (
                data.stores.map((store) => (
                  <tr
                    key={store.id}
                    className="hover:bg-gray-50/50 transition cursor-pointer"
                    onClick={() => router.push(`/admin/stores/${store.id}`)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 flex-shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{store.name}</p>
                          <p className="text-xs text-gray-400">{store.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-gray-600">{store.owner_email || "-"}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {store.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Activa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3 h-3" /> Suspendida
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                      {store.has_whatsapp ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <MessageSquare className="w-3.5 h-3.5" /> Conectado
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{formatDate(store.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/admin/stores/${store.id}`}
                          className="p-2 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600 transition"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleToggleStatus(store)}
                          disabled={actionLoading === store.id}
                          className={`p-2 rounded-lg transition ${
                            store.is_active
                              ? "hover:bg-red-50 text-gray-400 hover:text-red-600"
                              : "hover:bg-emerald-50 text-gray-400 hover:text-emerald-600"
                          } disabled:opacity-50`}
                          title={store.is_active ? "Suspender" : "Activar"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="text-gray-400 text-sm">No se encontraron tiendas</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.total)} de {data.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
