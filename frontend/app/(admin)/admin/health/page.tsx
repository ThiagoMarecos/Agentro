"use client";

import { useEffect, useState, useCallback } from "react";
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
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  ArrowRight,
} from "lucide-react";
import { getAdminHealth, HealthData, ServiceHealth, VPSResources } from "@/lib/api/admin";

/* ── Config ─────────────────────────────────────────────────── */

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
    ring: "ring-emerald-500/20",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Degradado",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
  },
  error: {
    icon: XCircle,
    label: "Error",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    ring: "ring-red-500/20",
  },
};

/* ── Helpers ────────────────────────────────────────────────── */

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getUsageColor(percent: number): string {
  if (percent < 50) return "bg-emerald-500";
  if (percent < 75) return "bg-amber-500";
  return "bg-red-500";
}

function getUsageTextColor(percent: number): string {
  if (percent < 50) return "text-emerald-600";
  if (percent < 75) return "text-amber-600";
  return "text-red-600";
}

/* ── Overall Banner ─────────────────────────────────────────── */

function OverallBanner({ status, serviceCount }: { status: "ok" | "error" | "degraded"; serviceCount: { ok: number; error: number; degraded: number } }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const messages = {
    ok: "Todos los sistemas operativos",
    degraded: "Algunos servicios presentan problemas",
    error: "Uno o más servicios están caídos",
  };

  return (
    <div className={`${config.bg} border ${config.border} rounded-xl p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center ring-4 ${config.ring}`}>
        <Icon className={`w-6 h-6 ${config.color}`} />
      </div>
      <div className="flex-1">
        <p className={`text-lg font-semibold ${config.color}`}>{config.label}</p>
        <p className="text-sm text-gray-600">{messages[status]}</p>
      </div>
      <div className="flex items-center gap-3">
        {serviceCount.ok > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> {serviceCount.ok} OK
          </span>
        )}
        {serviceCount.degraded > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {serviceCount.degraded}
          </span>
        )}
        {serviceCount.error > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
            <XCircle className="w-3 h-3" /> {serviceCount.error}
          </span>
        )}
        <span className={`w-3 h-3 rounded-full ${config.dot} animate-pulse`} />
      </div>
    </div>
  );
}

/* ── Service Card (clickeable, con acciones) ────────────────── */

function ServiceCard({ service }: { service: ServiceHealth }) {
  const [expanded, setExpanded] = useState(service.status !== "ok");
  const config = STATUS_CONFIG[service.status] || STATUS_CONFIG.error;
  const Icon = SERVICE_ICONS[service.name] || Zap;
  const StatusIcon = config.icon;
  const hasActions = service.actions && service.actions.length > 0;

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md cursor-pointer ${
        service.status === "ok" ? "border-gray-200/60" : config.border
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
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
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${config.dot} ${service.status !== "ok" ? "animate-pulse" : ""}`} />
            {hasActions && (
              expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2">
          {service.latency_ms !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Latencia</span>
              <span className={`font-mono font-medium ${
                service.latency_ms < 100 ? "text-emerald-600" : service.latency_ms < 500 ? "text-amber-600" : "text-red-600"
              }`}>
                {service.latency_ms} ms
              </span>
            </div>
          )}
          {service.details && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Detalle</span>
              <span className="text-gray-600 text-right max-w-[200px] truncate font-mono text-xs" title={service.details}>
                {service.details}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Actions */}
      {expanded && hasActions && (
        <div className={`border-t ${config.border} ${config.bg} px-5 py-4`}>
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            Acciones recomendadas
          </p>
          <div className="space-y-2">
            {service.actions!.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                <ArrowRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
                <span className="text-gray-700 font-mono text-xs leading-relaxed">{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Progress Bar ───────────────────────────────────────────── */

function UsageBar({ label, icon: Icon, used, total, unit, percent }: {
  label: string;
  icon: React.ElementType;
  used: number;
  total: number;
  unit: string;
  percent: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-900">{label}</span>
        </div>
        <span className={`text-sm font-bold ${getUsageTextColor(percent)}`}>
          {percent.toFixed(1)}%
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getUsageColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>{used} {unit} usado</span>
        <span>{total} {unit} total</span>
      </div>
    </div>
  );
}

/* ── VPS Resources Panel ────────────────────────────────────── */

function VPSPanel({ vps }: { vps: VPSResources }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Server className="w-5 h-5 text-violet-600" />
          Recursos del VPS
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          Uptime: {formatUptime(vps.uptime_seconds)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UsageBar
          label="CPU"
          icon={Cpu}
          used={vps.cpu_percent}
          total={100}
          unit="%"
          percent={vps.cpu_percent}
        />
        <UsageBar
          label="Memoria RAM"
          icon={MemoryStick}
          used={Math.round(vps.memory_used_mb)}
          total={Math.round(vps.memory_total_mb)}
          unit="MB"
          percent={vps.memory_percent}
        />
        <UsageBar
          label="Disco"
          icon={HardDrive}
          used={vps.disk_used_gb}
          total={vps.disk_total_gb}
          unit="GB"
          percent={vps.disk_percent}
        />
      </div>

      {/* Load Average */}
      <div className="bg-white rounded-xl border border-gray-200/60 p-5">
        <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          Load Average
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "1 min", value: vps.load_avg_1m },
            { label: "5 min", value: vps.load_avg_5m },
            { label: "15 min", value: vps.load_avg_15m },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className={`text-2xl font-bold ${
                item.value < 1 ? "text-emerald-600" : item.value < 2 ? "text-amber-600" : "text-red-600"
              }`}>
                {item.value.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {(vps.cpu_percent > 80 || vps.memory_percent > 85 || vps.disk_percent > 85) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800">Alerta de recursos</p>
            <div className="text-xs text-amber-700 space-y-0.5">
              {vps.cpu_percent > 80 && <p>⚠ CPU al {vps.cpu_percent.toFixed(1)}% — Considerar upgraear el plan o revisar procesos pesados</p>}
              {vps.memory_percent > 85 && <p>⚠ RAM al {vps.memory_percent.toFixed(1)}% — Reducir containers o agregar swap</p>}
              {vps.disk_percent > 85 && <p>⚠ Disco al {vps.disk_percent.toFixed(1)}% — Limpiar logs, imágenes antiguas de Docker: docker system prune</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchHealth = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const serviceCount = data
    ? {
        ok: data.services.filter((s) => s.status === "ok").length,
        error: data.services.filter((s) => s.status === "error").length,
        degraded: data.services.filter((s) => s.status === "degraded").length,
      }
    : { ok: 0, error: 0, degraded: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salud del Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado en tiempo real de servicios y recursos del VPS
            {lastCheck && (
              <span className="ml-2 text-gray-400">
                · {lastCheck.toLocaleTimeString("es")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition border ${
              autoRefresh
                ? "bg-violet-50 border-violet-200 text-violet-700"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-violet-500 animate-pulse" : "bg-gray-300"}`} />
            Auto {autoRefresh ? "ON" : "OFF"}
          </button>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Verificar
          </button>
        </div>
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
          {/* Overall status */}
          <OverallBanner status={data.overall} serviceCount={serviceCount} />

          {/* Service cards */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Servicios</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.services.map((service) => (
                <ServiceCard key={service.name} service={service} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Click en una tarjeta para ver acciones recomendadas
            </p>
          </div>

          {/* VPS Resources */}
          {data.vps && <VPSPanel vps={data.vps} />}

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
