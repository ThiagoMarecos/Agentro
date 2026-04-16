"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
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
  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-600",
  };

  const handleClick = () => {
    router.push(`/app/conversations?conv=${session.conversation_id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session.customer_name || session.customer_email || "Cliente"}
            </p>
            {session.customer_email && session.customer_name && (
              <p className="text-xs text-gray-400 truncate">{session.customer_email}</p>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityColors[session.priority] || priorityColors.medium}`}>
          {session.priority}
        </span>
      </div>

      {session.estimated_value && (
        <div className="flex items-center gap-1 mb-1.5">
          <DollarSign className="w-3.5 h-3.5 text-green-600" />
          <span className="text-sm font-semibold text-green-700">
            {formatPrice(Number(session.estimated_value), session.currency)}
          </span>
        </div>
      )}

      {session.last_agent_action && (
        <p className="text-xs text-gray-500 mb-1.5 truncate">{session.last_agent_action}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(session.stage_entered_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          {session.follow_up_count > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{session.follow_up_count} follow-ups</span>
            </div>
          )}
          <MessageSquare className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { currentStore } = useStore();
  const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentStore) return;
    setLoading(true);
    getSalesPipeline(currentStore.id)
      .then(setPipeline)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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

  const activeStages = pipeline.stages.filter(
    (s) => !["lost", "abandoned"].includes(s.stage)
  );
  const terminalStages = pipeline.stages.filter(
    (s) => ["lost", "abandoned"].includes(s.stage)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de Ventas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pipeline.total} sesiones activas
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {activeStages.map((stage) => (
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
              <div className={`rounded-b-lg border border-t-0 p-2 min-h-[200px] space-y-2 ${STAGE_COLORS[stage.stage] || "bg-gray-50 border-gray-200"}`}>
                {stage.sessions.length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-8">
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

      {terminalStages.some((s) => s.count > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Sesiones terminales
          </h2>
          <div className="flex gap-4">
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
    </div>
  );
}
