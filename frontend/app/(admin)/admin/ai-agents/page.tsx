"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Building2,
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { authFetch } from "@/lib/auth";

interface StoreAgentSummary {
  store_id: string;
  store_name: string;
  store_slug: string;
  agents: AgentItem[];
}

interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  agent_type: string;
  is_active: boolean;
  enabled_tools: string[] | null;
  system_prompt: string | null;
  config: Record<string, any>;
  created_at: string;
}

/* ── Helpers ─────────────────────────────────────── */

function ToolBadge({ tool }: { tool: string }) {
  const colorMap: Record<string, string> = {
    product_search: "bg-blue-100 text-blue-700",
    product_detail: "bg-blue-100 text-blue-700",
    check_availability: "bg-cyan-100 text-cyan-700",
    recommend_product: "bg-indigo-100 text-indigo-700",
    create_order: "bg-emerald-100 text-emerald-700",
    create_payment_link: "bg-green-100 text-green-700",
    estimate_shipping: "bg-teal-100 text-teal-700",
    update_notebook: "bg-gray-100 text-gray-700",
    move_stage: "bg-purple-100 text-purple-700",
    notify_owner: "bg-amber-100 text-amber-700",
    escalate_to_human: "bg-red-100 text-red-700",
    get_store_info: "bg-gray-100 text-gray-600",
    get_store_discounts: "bg-yellow-100 text-yellow-700",
    all: "bg-violet-100 text-violet-700 font-semibold",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${colorMap[tool] || "bg-gray-100 text-gray-600"}`}>
      {tool}
    </span>
  );
}

function AgentRow({ agent }: { agent: AgentItem }) {
  const [expanded, setExpanded] = useState(false);
  const tools = agent.enabled_tools || [];
  const hasAll = tools.includes("all");

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />

        {/* Name + type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{agent.name}</p>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
              {agent.agent_type}
            </span>
            {hasAll && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> Full
              </span>
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{agent.description}</p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {agent.is_active ? (
            <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">Activo</span></>
          ) : (
            <><XCircle className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-400">Inactivo</span></>
          )}
        </div>

        {expanded
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 space-y-4 pt-4">
          {/* Config */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Modelo</p>
              <p className="text-sm font-mono text-gray-800">{agent.config?.model || "gpt-4o"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Temperatura</p>
              <p className="text-sm font-mono text-gray-800">{agent.config?.temperature ?? 0.6}</p>
            </div>
          </div>

          {/* Tools */}
          {tools.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Wrench className="w-3 h-3" /> Herramientas habilitadas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t) => <ToolBadge key={t} tool={t} />)}
              </div>
            </div>
          )}

          {/* Custom instructions */}
          {agent.system_prompt && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Instrucciones personalizadas del dueño
              </p>
              <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto border border-gray-200">
                {agent.system_prompt}
              </pre>
            </div>
          )}
          {!agent.system_prompt && (
            <p className="text-xs text-gray-400 italic">Sin instrucciones personalizadas — usa el prompt maestro de ventas</p>
          )}
        </div>
      )}
    </div>
  );
}

function StoreAgentCard({ store }: { store: StoreAgentSummary }) {
  const [open, setOpen] = useState(true);
  const activeCount = store.agents.filter((a) => a.is_active).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4.5 h-4.5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{store.store_name}</p>
          <p className="text-xs text-gray-400">{store.store_slug}.getagentro.com</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-500">
            {activeCount}/{store.agents.length} activos
          </span>
          {open
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-2">
          {store.agents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin agentes configurados</p>
          ) : (
            store.agents.map((agent) => <AgentRow key={agent.id} agent={agent} />)
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════ */
/*             ADMIN AI AGENTS PAGE                    */
/* ════════════════════════════════════════════════════ */

export default function AdminAIAgentsPage() {
  const [stores, setStores] = useState<StoreAgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    authFetch("/api/v1/admin/ai-agents")
      .then((r) => r.json())
      .then((data) => setStores(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-violet-50">
          <Bot className="w-7 h-7 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes IA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Agentes de ventas de todas las tiendas · Solo lectura
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200/60 rounded-xl p-4">
        <Zap className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-violet-800">
          <strong>El flujo de venta es automático</strong> — el prompt maestro codifica las 5 fases (descubrimiento, validación, negociación, pago, entrega) para todas las tiendas.
          Los dueños solo configuran <strong>instrucciones específicas de su negocio</strong> desde su panel.
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && stores.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium">Sin tiendas con agentes</p>
        </div>
      )}

      <div className="space-y-4">
        {stores.map((store) => (
          <StoreAgentCard key={store.store_id} store={store} />
        ))}
      </div>
    </div>
  );
}
