"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  Power,
  Mail,
  ChevronLeft,
  ChevronRight,
  Building2,
  Clock,
} from "lucide-react";
import {
  getAdminUsers,
  updateUserStatus,
  UserListItem,
  UserListResponse,
} from "@/lib/api/admin";

export default function AdminUsersPage() {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminUsers({ page, page_size: pageSize, search, status: statusFilter });
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user: UserListItem) => {
    if (user.is_superadmin) return;
    setActionLoading(user.id);
    try {
      await updateUserStatus(user.id, !user.is_active);
      await fetchUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "Nunca";
    const d = new Date(iso);
    return d.toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">Gestión de todos los usuarios registrados en la plataforma</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por email o nombre..."
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
              {s === "all" ? "Todos" : s === "active" ? "Activos" : "Suspendidos"}
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Proveedor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Tiendas</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Último acceso</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Registro</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="animate-pulse text-gray-400 text-sm">Cargando usuarios...</div>
                  </td>
                </tr>
              ) : data && data.users.length > 0 ? (
                data.users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          user.is_superadmin ? "bg-violet-100 text-violet-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          {user.is_superadmin ? <Shield className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.full_name || user.email.split("@")[0]}
                            {user.is_superadmin && (
                              <span className="ml-2 text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md uppercase">
                                Admin
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                        user.auth_provider === "google"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        <Mail className="w-3 h-3" />
                        {user.auth_provider === "google" ? "Google" : "Email"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3 h-3" /> Suspendido
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {user.store_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatDateTime(user.last_login_at)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-gray-500">{formatDate(user.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end">
                        {!user.is_superadmin && (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={actionLoading === user.id}
                            className={`p-2 rounded-lg transition ${
                              user.is_active
                                ? "hover:bg-red-50 text-gray-400 hover:text-red-600"
                                : "hover:bg-emerald-50 text-gray-400 hover:text-emerald-600"
                            } disabled:opacity-50`}
                            title={user.is_active ? "Suspender" : "Activar"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="text-gray-400 text-sm">No se encontraron usuarios</div>
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
