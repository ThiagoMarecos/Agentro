"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import {
  getDashboard,
  getRecentConversations,
  type DashboardPayload,
  type RecentConversation,
} from "@/lib/api/agent-performance";
import {
  BarChart3,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Search,
  DollarSign,
  MessageSquare,
  Users,
  Coins,
  ArrowDown,
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  incoming: "Recepción",
  discovery: "Descubrimiento",
  recommendation: "Recomendación",
  validation: "Validación",
  closing: "Cierre",
  payment: "Pago",
  order_created: "Orden creada",
  shipping: "Envío",
  completed: "Completado",
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  sale_completed: { label: "Venta cerrada", color: "bg-emerald-100 text-emerald-700" },
  ongoing: { label: "En curso", color: "bg-blue-100 text-blue-700" },
  escalated: { label: "Escalada", color: "bg-amber-100 text-amber-700" },
  dropped_off: { label: "Abandonada", color: "bg-rose-100 text-rose-700" },
  abandoned: { label: "Abandonada", color: "bg-rose-100 text-rose-700" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "indigo" | "emerald" | "rose" | "amber" | "gray";
}) {
  const tones: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    gray: "bg-gray-100 text-gray-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
        {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

export default function AgentPerformancePage() {
  const { currentStore } = useStore();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [convs, setConvs] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<string>("");

  const fetchAll = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        getDashboard(currentStore.id, days),
        getRecentConversations(currentStore.id, {
          limit: 50,
          outcome: outcomeFilter || undefined,
          stage: stageFilter || undefined,
        }),
      ]);
      setData(d);
      setConvs(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore, days, outcomeFilter, stageFilter]);

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Selecciona una tienda</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const overview = data.overview;
  const maxFunnel = Math.max(...data.funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-indigo-50">
            <BarChart3 className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rendimiento del Agente IA</h1>
            <p className="text-sm text-gray-500 mt-1">
              Métricas y funnel de conversión · últimos {days} días
            </p>
          </div>
        </div>

        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={365}>Último año</option>
        </select>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Conversaciones"
          value={overview.total_conversations}
          tone="indigo"
        />
        <StatCard
          icon={CheckCircle2}
          label="Ventas cerradas"
          value={overview.completed_sales}
          hint={`Tasa de éxito: ${overview.success_rate}%`}
          tone="emerald"
        />
        <StatCard
          icon={AlertTriangle}
          label="Escaladas"
          value={overview.escalated}
          tone="amber"
        />
        <StatCard
          icon={TrendingDown}
          label="Abandonadas"
          value={overview.dropped}
          tone="rose"
        />
        <StatCard
          icon={DollarSign}
          label="Valor total ventas"
          value={`$${overview.total_sales_value.toLocaleString()}`}
          tone="emerald"
        />
        <StatCard
          icon={MessageSquare}
          label="Mensajes totales"
          value={overview.total_messages.toLocaleString()}
          tone="gray"
        />
        <StatCard
          icon={Coins}
          label="Tokens usados"
          value={overview.total_tokens.toLocaleString()}
          hint={`~$${overview.estimated_cost_usd.toFixed(2)} USD`}
          tone="gray"
        />
        <StatCard
          icon={Clock}
          label="Tiempo respuesta"
          value={`${data.response_time.avg_seconds}s`}
          hint={`Mediana: ${data.response_time.median_seconds}s`}
          tone="indigo"
        />
      </div>

      {/* Funnel */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Funnel de conversión</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Cuántas conversaciones llegaron a cada etapa
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 p-6 space-y-3">
          {data.funnel.map((f, idx) => {
            const widthPct = (f.count / maxFunnel) * 100;
            const isFirst = idx === 0;
            return (
              <div key={f.stage}>
                {!isFirst && f.dropoff_from_previous_pct > 0 && (
                  <div className="flex items-center gap-1 ml-2 mb-1 text-[10px] text-rose-500 font-medium">
                    <ArrowDown className="w-3 h-3" />
                    -{f.dropoff_from_previous_pct}% drop-off
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-32 text-xs font-medium text-gray-700 shrink-0">
                    {STAGE_LABELS[f.stage] || f.stage}
                  </div>
                  <div className="flex-1 h-9 bg-gray-100 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                      style={{ width: `${Math.max(widthPct, 2)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-bold text-white drop-shadow-sm">
                        {f.count}
                      </span>
                      <span className="text-[10px] text-gray-600 ml-auto">
                        {f.percent_of_total}% del total
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Drop-off + Outcomes */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Mayor abandono</h2>
          <div className="bg-white rounded-2xl border border-gray-200/60 p-5 space-y-2">
            {data.dropoff.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Sin datos suficientes
              </p>
            ) : (
              data.dropoff.map((d) => (
                <div
                  key={d.stage}
                  className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {STAGE_LABELS[d.stage] || d.stage}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {d.count} conversaciones llegaron aquí
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-600 text-xs font-bold">
                    <ArrowDown className="w-3 h-3" />
                    {d.dropoff_from_previous_pct}%
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Outcomes</h2>
          <div className="bg-white rounded-2xl border border-gray-200/60 p-5 space-y-2">
            {data.outcomes.map((o) => {
              const meta = OUTCOME_LABELS[o.outcome] || {
                label: o.outcome,
                color: "bg-gray-100 text-gray-600",
              };
              return (
                <div
                  key={o.outcome}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100"
                >
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{o.count}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Zero-result searches */}
      {data.zero_result_searches.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Productos no encontrados
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Lo que el cliente pidió pero el agente no pudo ofrecer (oportunidad de
              expandir catálogo)
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200/60 p-5 space-y-1">
            {data.zero_result_searches.slice(0, 10).map((z, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700">{z.query_excerpt}</span>
                </div>
                <span className="text-xs font-bold text-gray-500">
                  {z.occurrences}×
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent conversations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Conversaciones recientes</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Inspeccioná lo que pasó en cada conversación
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs"
            >
              <option value="">Todos los outcomes</option>
              <option value="sale_completed">Venta cerrada</option>
              <option value="ongoing">En curso</option>
              <option value="escalated">Escalada</option>
              <option value="dropped_off">Abandonada</option>
            </select>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs"
            >
              <option value="">Todas las etapas</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Etapa final</th>
                <th className="px-4 py-3 text-left font-medium">Outcome</th>
                <th className="px-4 py-3 text-right font-medium">Tools</th>
                <th className="px-4 py-3 text-right font-medium">Tokens</th>
                <th className="px-4 py-3 text-right font-medium">Valor est.</th>
              </tr>
            </thead>
            <tbody>
              {convs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">
                    Sin conversaciones en el rango seleccionado
                  </td>
                </tr>
              ) : (
                convs.map((c) => {
                  const meta = OUTCOME_LABELS[c.outcome] || {
                    label: c.outcome,
                    color: "bg-gray-100 text-gray-600",
                  };
                  return (
                    <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {c.created_at
                          ? new Date(c.created_at).toLocaleString("es")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.last_stage_reached
                          ? STAGE_LABELS[c.last_stage_reached] || c.last_stage_reached
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {c.tool_calls_count}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">
                        {c.total_tokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {c.estimated_value
                          ? `$${c.estimated_value.toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
