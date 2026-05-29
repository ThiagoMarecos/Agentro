"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { useAuth } from "@/app/providers/AuthProvider";
import { DashboardTour, type TourStep } from "@/components/onboarding-tour/DashboardTour";

const PIPELINE_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="pipeline-header"]',
    placement: "bottom",
    title: "Pipeline IA — el embudo de ventas vivo",
    body: "Cada vez que un cliente chatea (web, WhatsApp, IG), el agente IA crea una 'sesión de venta' que aparece acá. Las sesiones activas son las que están en curso ahora mismo.",
  },
  {
    selector: '[data-tour="pipeline-board"]',
    placement: "top",
    title: "Las etapas del embudo",
    body: "Cada columna es una etapa: descubrimiento, calificación, presentación, negociación, cierre. El agente mueve a los clientes según cómo va la conversación. Vos ves en tiempo real cuántos clientes están en cada etapa y dónde se traba el embudo.",
  },
  {
    centered: true,
    title: "¿Cómo usar el pipeline?",
    body: "Click en cualquier card para ver la conversación completa, lo que el cliente está mirando, su intención y tomar control si querés cerrar vos. Las sesiones terminales (vendido, abandonado, escalado) quedan más abajo para análisis. Te ayuda a saber: qué etapa está cuello de botella, qué clientes están calientes y dónde el bot necesita ayuda.",
  },
];
import {
  getSalesPipeline,
  PipelineResponse,
  SalesSessionListItem,
} from "@/lib/api/sales-sessions";
import { formatPrice } from "@/lib/utils/formatPrice";
import {
  Loader2,
  User,
  Clock,
  DollarSign,
  AlertCircle,
  MessageSquare,
  Kanban,
  Activity,
  TrendingUp,
  Users,
} from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  incoming: "Entrante",
  discovery: "Descubrimiento",
  recommendation: "Recomendación",
  validation: "Validación",
  closing: "Cierre",
  payment: "Pago",
  order_created: "Orden Creada",
  shipping: "Envío",
  completed: "Completado",
  lost: "Perdido",
  abandoned: "Abandonado",
};

// Etapas internas del agente que NO mostramos en el pipeline visible.
// Son micro-pasos del flujo conversacional, no embudo de venta.
const HIDDEN_STAGES = new Set([
  "negotiation",
  "data_collection",
  "escalated_to_seller",
]);

const STAGE_COLORS: Record<string, string> = {
  incoming: "bg-blue-50 border-blue-200 text-blue-700",
  discovery: "bg-purple-50 border-purple-200 text-purple-700",
  recommendation: "bg-indigo-50 border-indigo-200 text-indigo-700",
  validation: "bg-amber-50 border-amber-200 text-amber-700",
  closing: "bg-orange-50 border-orange-200 text-orange-700",
  payment: "bg-yellow-50 border-yellow-200 text-yellow-700",
  order_created: "bg-emerald-50 border-emerald-200 text-emerald-700",
  shipping: "bg-cyan-50 border-cyan-200 text-cyan-700",
  completed: "bg-green-50 border-green-200 text-green-700",
  lost: "bg-red-50 border-red-200 text-red-700",
  abandoned: "bg-gray-50 border-gray-200 text-gray-500",
};

const STAGE_HEADER_COLORS: Record<string, string> = {
  incoming: "bg-blue-500",
  discovery: "bg-purple-500",
  recommendation: "bg-indigo-500",
  validation: "bg-amber-500",
  closing: "bg-orange-500",
  payment: "bg-yellow-500",
  order_created: "bg-emerald-500",
  shipping: "bg-cyan-500",
  completed: "bg-green-500",
  lost: "bg-red-500",
  abandoned: "bg-gray-400",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function SessionCard({ session }: { session: SalesSessionListItem }) {
  const router = useRouter();
  const priorityMeta: Record<string, { label: string; cls: string; dot: string }> = {
    high:   { label: "ALTA",  cls: "text-rose-700 bg-rose-100",   dot: "bg-rose-500" },
    medium: { label: "MEDIA", cls: "text-amber-700 bg-amber-100", dot: "bg-amber-500" },
    low:    { label: "BAJA",  cls: "text-gray-600 bg-gray-100",   dot: "bg-gray-400" },
  };
  const prio = priorityMeta[session.priority] || priorityMeta.medium;

  const handleClick = () => {
    router.push(`/app/conversations?conv=${session.conversation_id}`);
  };

  const initial = (session.customer_name || session.customer_email || "?").charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md hover:border-indigo-300 hover:-translate-y-0.5 transition-all cursor-pointer group block"
    >
      {/* Header con avatar + priority */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center flex-shrink-0 text-xs font-semibold shadow-sm">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
            {session.customer_name || session.customer_email || "Cliente anónimo"}
          </p>
          {session.customer_email && session.customer_name && (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{session.customer_email}</p>
          )}
        </div>
        <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${prio.cls} flex-shrink-0`}>
          <span className={`w-1 h-1 rounded-full ${prio.dot}`} />
          {prio.label}
        </span>
      </div>

      {/* Valor estimado */}
      {session.estimated_value && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-emerald-50">
          <DollarSign className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-bold text-emerald-700">
            {formatPrice(Number(session.estimated_value), session.currency)}
          </span>
        </div>
      )}

      {/* Última acción del agente */}
      {session.last_agent_action && (
        <p className="text-[11px] text-gray-500 mb-2 line-clamp-2 leading-snug">
          “{session.last_agent_action}”
        </p>
      )}

      {/* Footer: tiempo + follow-ups + arrow */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(session.stage_entered_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          {session.follow_up_count > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-3 h-3" />
              <span className="font-medium">{session.follow_up_count}</span>
            </div>
          )}
          <MessageSquare className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  );
}

export default function PipelinePage() {
  const { currentStore } = useStore();
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPipeline = (storeId: string, showLoader = false) => {
    if (showLoader) setLoading(true);
    getSalesPipeline(storeId)
      .then(setPipeline)
      .catch((e) => setError(e.message))
      .finally(() => { if (showLoader) setLoading(false); });
  };

  useEffect(() => {
    if (!currentStore) return;
    fetchPipeline(currentStore.id, true);
    intervalRef.current = setInterval(() => fetchPipeline(currentStore.id), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentStore]);

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Selecciona una tienda para ver el pipeline
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Error: {error}
      </div>
    );
  }

  if (!pipeline) return null;

  // Filtramos las etapas internas (no son del embudo visible)
  const visibleStages = pipeline.stages.filter((s) => !HIDDEN_STAGES.has(s.stage));
  const activeStages = visibleStages.filter(
    (s) => !["lost", "abandoned"].includes(s.stage)
  );
  const terminalStages = visibleStages.filter(
    (s) => ["lost", "abandoned"].includes(s.stage)
  );

  // Stats agregados
  const totalActive = activeStages.reduce((sum, s) => sum + s.count, 0);
  const totalCompleted = pipeline.stages
    .filter((s) => ["completed", "order_created"].includes(s.stage))
    .reduce((sum, s) => sum + s.count, 0);
  const totalLost = terminalStages.reduce((sum, s) => sum + s.count, 0);
  const pipelineValue = activeStages.reduce((sum, stage) => {
    return sum + stage.sessions.reduce((s, sess) => s + Number(sess.estimated_value || 0), 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div data-tour="pipeline-header" className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 mb-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE · ACTUALIZACIÓN EN VIVO
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2.5">
            <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm shadow-indigo-500/30">
              <Kanban className="w-4.5 h-4.5" />
            </span>
            Pipeline IA
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 max-w-2xl">
            El embudo de ventas vivo de tu agente IA. Cada cliente que chatea aparece como una sesión
            que se mueve entre etapas según cómo progresa la conversación. Se actualiza cada 10 segundos.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white border border-gray-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">{totalActive}</p>
            <p className="text-xs text-gray-400 mt-0.5">Sesiones activas</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-gray-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">
              {formatPrice(pipelineValue, currentStore?.currency)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Valor en pipeline</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-gray-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">{totalCompleted}</p>
            <p className="text-xs text-gray-400 mt-0.5">Convertidos</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white border border-gray-200/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 leading-none">{totalLost}</p>
            <p className="text-xs text-gray-400 mt-0.5">Perdidos / abandonados</p>
          </div>
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div data-tour="pipeline-board" className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-3 min-w-max">
          {activeStages.map((stage) => (
            <div key={stage.stage} className="w-72 flex-shrink-0">
              {/* Column header */}
              <div className={`rounded-t-xl px-3.5 py-2.5 ${STAGE_HEADER_COLORS[stage.stage]} text-white shadow-sm`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {STAGE_LABELS[stage.stage] || stage.stage}
                  </span>
                  <span className="text-[11px] bg-white/25 rounded-full px-2 py-0.5 font-mono font-semibold">
                    {stage.count}
                  </span>
                </div>
              </div>
              {/* Column body */}
              <div className={`rounded-b-xl border border-t-0 p-2 min-h-[280px] space-y-2 ${STAGE_COLORS[stage.stage] || "bg-gray-50 border-gray-200"}`}>
                {stage.sessions.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <div className="w-8 h-8 rounded-full bg-white/60 mx-auto mb-2 grid place-items-center">
                      <Activity className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Sin sesiones en esta etapa
                    </p>
                  </div>
                ) : (
                  stage.sessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {terminalStages.some((s) => s.count > 0) && (
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Sesiones terminales
            </h2>
            <span className="text-xs text-gray-400">·  para análisis post-mortem</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {terminalStages.map((stage) => (
              <div key={stage.stage} className="w-72 flex-shrink-0">
                <div className={`rounded-t-lg px-3 py-2 ${STAGE_HEADER_COLORS[stage.stage]} text-white`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {STAGE_LABELS[stage.stage] || stage.stage}
                    </span>
                    <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
                      {stage.count}
                    </span>
                  </div>
                </div>
                <div className={`rounded-b-lg border border-t-0 p-2 min-h-[100px] space-y-2 ${STAGE_COLORS[stage.stage] || "bg-gray-50 border-gray-200"}`}>
                  {stage.sessions.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-4">
                      Sin sesiones
                    </p>
                  )}
                  {stage.sessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tour de la página de pipeline */}
      {user && (
        <DashboardTour
          steps={PIPELINE_TOUR_STEPS}
          storageKey={`agentro:tour-pipeline:${user.id}`}
        />
      )}
    </div>
  );
}
