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
  Edit3,
  Save,
  X,
} from "lucide-react";
import { getAdminAIAgents, updateAdminAgent } from "@/lib/api/admin";

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

interface StoreAgentSummary {
  store_id: string;
  store_name: string;
  store_slug: string;
  agents: AgentItem[];
}

/* ── Tool badge ──────────────────────────────────── */

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

/* ── Agent Row ───────────────────────────────────── */

function AgentRow({
  agent,
  storeId,
  onUpdated,
}: {
  agent: AgentItem;
  storeId: string;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(agent.system_prompt || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const tools = agent.enabled_tools || [];
  const hasAll = tools.includes("all");

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await updateAdminAgent(storeId, agent.id, { system_prompt: prompt });
      setEditing(false);
      onUpdated();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await updateAdminAgent(storeId, agent.id, { is_active: !agent.is_active });
      onUpdated();
    } catch {
      // silent
    }
  };

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-4">
        {/* Expand toggle */}
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.is_active ? "bg-emerald-500" : "bg-gray-300"}`} />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{agent.name}</p>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
              {agent.agent_type}
            </span>
            {hasAll && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" /> Full tools
              </span>
            )}
          </div>
          {agent.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{agent.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active toggle */}
          <button
            onClick={handleToggleActive}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition ${
              agent.is_active
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {agent.is_active ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Activo</>
            ) : (
              <><XCircle className="w-3.5 h-3.5" /> Inactivo</>
            )}
          </button>

          {/* Edit prompt button */}
          <button
            onClick={() => { setExpanded(true); setEditing(true); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition"
          >
            <Edit3 className="w-3.5 h-3.5" /> Prompt
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
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
                <Wrench className="w-3 h-3" /> Herramientas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t) => <ToolBadge key={t} tool={t} />)}
              </div>
            </div>
          )}

          {/* Prompt editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Instrucciones personalizadas del dueño
              </p>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-[11px] text-violet-600 hover:text-violet-800 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> Editar
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2.5 rounded-lg border border-violet-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:outline-none text-sm font-mono text-gray-800 bg-white resize-y"
                  placeholder={"Ej:\n- Somos una tienda de ropa en Paraguay\n- Envío gratis en compras mayores a 200.000 Gs\n- Tratá a los clientes de 'vos'"}
                />
                {saveError && (
                  <p className="text-xs text-red-600">{saveError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setPrompt(agent.system_prompt || ""); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              agent.system_prompt ? (
                <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto border border-gray-200">
                  {agent.system_prompt}
                </pre>
              ) : (
                <div className="bg-gray-50 rounded-lg p-3 border border-dashed border-gray-200">
                  <p className="text-xs text-gray-400 italic">
                    Sin instrucciones personalizadas — usa el prompt maestro de ventas automático.
                  </p>
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-2 text-xs text-violet-600 hover:underline"
                  >
                    + Agregar instrucciones
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Store Card ──────────────────────────────────── */

function StoreAgentCard({
  store,
  onUpdated,
}: {
  store: StoreAgentSummary;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(true);
  const activeCount = store.agents.filter((a) => a.is_active).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{store.store_name}</p>
          <p className="text-xs text-gray-400">{store.store_slug}.getagentro.com</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-gray-500">
            {activeCount}/{store.agents.length} activos
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-2">
          {store.agents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin agentes configurados</p>
          ) : (
            store.agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                storeId={store.store_id}
                onUpdated={onUpdated}
              />
            ))
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

  const load = () => {
    setLoading(true);
    getAdminAIAgents()
      .then(setStores)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
            Agentes de ventas de todas las tiendas · Podés editar las instrucciones de cada tienda
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 bg-violet-50 border border-violet-200/60 rounded-xl p-4">
        <Zap className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-violet-800">
          <strong>El flujo de venta es automático</strong> — el prompt maestro ya maneja las 5 fases.
          Las <strong>instrucciones personalizadas</strong> son reglas específicas del negocio de cada tienda
          (nombre, horarios, condiciones de envío, tono, etc.).
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
          <p className="text-xs mt-1">Se crean automáticamente cuando el dueño crea una tienda</p>
        </div>
      )}

      <div className="space-y-4">
        {stores.map((store) => (
          <StoreAgentCard key={store.store_id} store={store} onUpdated={load} />
        ))}
      </div>
    </div>
  );
}
