"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  RefreshCw,
} from "lucide-react";
import {
  getAdminLogs,
  PlatformLogItem,
  PlatformLogResponse,
} from "@/lib/api/admin";

const ACTION_COLORS: Record<string, string> = {
  store_activated: "bg-emerald-50 text-emerald-700",
  store_suspended: "bg-red-50 text-red-700",
  user_activated: "bg-emerald-50 text-emerald-700",
  user_suspended: "bg-red-50 text-red-700",
  product_created: "bg-blue-50 text-blue-700",
  product_updated: "bg-blue-50 text-blue-700",
  order_created: "bg-amber-50 text-amber-700",
  settings_updated: "bg-violet-50 text-violet-700",
};

function getActionColor(action: string): string {
  return ACTION_COLORS[action] || "bg-gray-100 text-gray-600";
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminLogsPage() {
  const [data, setData] = useState<PlatformLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminLogs({ page, page_size: pageSize, action_filter: actionFilter });
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const formatDateTime = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs de Actividad</h1>
          <p className="text-sm text-gray-500 mt-1">Registro de todas las acciones en la plataforma</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filtrar por acción..."
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
          />
        </div>
        {data && (
          <div className="flex items-center text-sm text-gray-500">
            {data.total} registros encontrados
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
      )}

      {/* Logs List */}
      <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {loading ? (
            <div className="px-5 py-12 text-center">
              <div className="animate-pulse text-gray-400 text-sm">Cargando logs...</div>
            </div>
          ) : data && data.logs.length > 0 ? (
            data.logs.map((log) => (
              <div key={log.id} className="px-5 py-4 hover:bg-gray-50/50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0 mt-0.5">
                      <ScrollText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getActionColor(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                        {log.resource_type && (
                          <span className="text-xs text-gray-400">
                            {log.resource_type}
                          </span>
                        )}
                      </div>
                      {log.details && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{log.details}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {log.user_email && (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" /> {log.user_email}
                          </span>
                        )}
                        {log.store_name && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {log.store_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-12 text-center">
              <div className="text-gray-400 text-sm">No se encontraron logs</div>
            </div>
          )}
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
