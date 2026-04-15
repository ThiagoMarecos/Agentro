"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Server,
  MessageSquare,
  Brain,
  Zap,
} from "lucide-react";
import { getAdminHealth, HealthData, ServiceHealth } from "@/lib/api/admin";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  PostgreSQL: Database,
  Redis: Server,
  "Evolution API": MessageSquare,
  OpenAI: Brain,
};

const STATUS_CONFIG = {
  ok: {
    icon: CheckCircle2,
    label: "Operativo",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Degradado",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  error: {
    icon: XCircle,
    label: "Error",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
};

function OverallBanner({ status }: { status: "ok" | "error" | "degraded" }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const messages = {
    ok: "Todos los sistemas operativos",
    degraded: "Algunos servicios presentan problemas",
    error: "Uno o más servicios están caídos",
  };

  return (
    <div className={`${config.bg} border ${config.border} rounded-xl p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${config.color}`} />
      </div>
      <div>
        <p className={`text-lg font-semibold ${config.color}`}>{config.label}</p>
        <p className="text-sm text-gray-600">{messages[status]}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${config.dot} animate-pulse`} />
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const config = STATUS_CONFIG[service.status] || STATUS_CONFIG.error;
  const Icon = SERVICE_ICONS[service.name] || Zap;
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-5 hover:shadow-sm transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{service.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
              <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
            </div>
          </div>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
      </div>

      <div className="space-y-2">
        {service.latency_ms !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Latencia</span>
            <span className={`font-medium ${
              service.latency_ms < 100 ? "text-emerald-600" : service.latency_ms < 500 ? "text-amber-600" : "text-red-600"
            }`}>
              {service.latency_ms} ms
            </span>
          </div>
        )}
        {service.details && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Detalle</span>
            <span className="text-gray-600 text-right max-w-[200px] truncate" title={service.details}>
              {service.details}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminHealth();
      setData(res);
      setLastCheck(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salud del Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado en tiempo real de todos los servicios
            {lastCheck && (
              <span className="ml-2 text-gray-400">
                · Última verificación: {lastCheck.toLocaleTimeString("es")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Verificar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Verificando servicios...</span>
          </div>
        </div>
      ) : data ? (
        <>
          <OverallBanner status={data.overall} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.services.map((service) => (
              <ServiceCard key={service.name} service={service} />
            ))}
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Leyenda</p>
            <div className="flex flex-wrap gap-6">
              {(["ok", "degraded", "error"] as const).map((s) => {
                const c = STATUS_CONFIG[s];
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className="text-xs text-gray-600">{c.label} — {
                      s === "ok" ? "Servicio funcionando correctamente" :
                      s === "degraded" ? "Servicio con respuesta lenta o parcial" :
                      "Servicio no disponible"
                    }</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
