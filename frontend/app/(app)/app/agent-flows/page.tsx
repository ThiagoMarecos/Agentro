"use client";

/**
 * /app/agent-flows — Listado de flows del agente para la store actual.
 * Enterprise feature (gated por backend).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/context/StoreContext";
import {
  listFlows,
  createFlow,
  deleteFlow,
  activateFlow,
  generateFlow,
  type AgentFlow,
} from "@/lib/api/agent-flows";
import { getBillingSummary, setAgentMode, type AgentMode, type BillingSummary } from "@/lib/api/billing";
import { getWhatsAppStatus } from "@/lib/api/whatsapp";
import { FeatureGate } from "@/components/ui/FeatureGate";
import { Workflow, Plus, Trash2, Play, ArrowRight, Bot, Sparkles, Info, MessageCircle, CheckCircle2, AlertTriangle, X, Wand2, Loader2 } from "lucide-react";

export default function AgentFlowsPage() {
  const { currentStore } = useStore();

  return (
    <FeatureGate
      feature="flow_editor"
      storeId={currentStore?.id ?? null}
      upgradeMessage="El editor de diagrama de flujo está disponible en el plan Enterprise. Upgrade para diseñar visualmente el comportamiento del agente."
    >
      <FlowsList />
    </FeatureGate>
  );
}

function FlowsList() {
  const { currentStore } = useStore();
  const [flows, setFlows] = useState<AgentFlow[]>([]);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [activatedInfo, setActivatedInfo] = useState<{ flowId: string; whatsappConnected: boolean } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const reload = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [list, b] = await Promise.all([
        listFlows(currentStore.id),
        getBillingSummary(currentStore.id).catch(() => null),
      ]);
      setFlows(list);
      setBilling(b);
      setError("");
    } catch (e: any) {
      setError(e.message || "Error cargando flows");
    } finally {
      setLoading(false);
    }
  };

  const onChangeMode = async (mode: AgentMode) => {
    if (!currentStore) return;
    try {
      await setAgentMode(currentStore.id, mode);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error cambiando modo");
    }
  };

  const onCreateFromTemplate = async () => {
    if (!currentStore) return;
    setCreatingTemplate(true);
    try {
      const { nodes, edges } = buildAgentroV2Template();
      const flow = await createFlow(currentStore.id, {
        name: "Plantilla Agentro v2 (pre-venta + escalamiento)",
        description: "Saludo → escucha la respuesta → ramifica por intent (precio, stock, compra) → escala a humano cuando el cliente está listo.",
        nodes,
        edges,
      });
      window.location.href = `/app/agent-flows/${flow.id}`;
    } catch (e: any) {
      alert(e.message || "Error creando template");
      setCreatingTemplate(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id]);

  const onActivate = async (flowId: string) => {
    if (!currentStore) return;
    try {
      await activateFlow(currentStore.id, flowId);
      // Tras activar, chequear conexión WhatsApp para avisar al usuario dónde
      // probar el agente (web chat siempre / WhatsApp si está conectado).
      const wa = await getWhatsAppStatus(currentStore.id).catch(() => null);
      const connected = wa?.connection_status === "connected";
      setActivatedInfo({ flowId, whatsappConnected: connected });
      await reload();
    } catch (e: any) {
      alert(e.message || "Error activando flow");
    }
  };

  const onDelete = async (flowId: string, name: string) => {
    if (!currentStore) return;
    if (!confirm(`¿Borrar el flow "${name}"? No se puede deshacer.`)) return;
    try {
      await deleteFlow(currentStore.id, flowId);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error borrando flow");
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Cargando flows…</div>;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="w-7 h-7 text-indigo-600" />
            Flujo del agente
          </h1>
          <p className="text-gray-700 text-sm mt-1.5">
            Elegí si usar el agente pre-entrenado de Agentro o construir tu flujo custom.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Wand2 className="w-4 h-4" />
            Generar con IA
          </button>
          <button
            onClick={onCreateFromTemplate}
            disabled={creatingTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            <Sparkles className="w-4 h-4" />
            {creatingTemplate ? "Creando…" : "Desde template"}
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            En blanco
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      {billing && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-900">¿Quién maneja tu agente?</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <ModeCard
              active={billing.agent_mode === "pretrained"}
              onClick={() => onChangeMode("pretrained")}
              icon={Bot}
              title="Agente pre-entrenado"
              desc="El agente curado de Agentro. Funciona de una, sin que toques nada. Recomendado para arrancar."
              badge="Recomendado"
            />
            <ModeCard
              active={billing.agent_mode === "custom_flow"}
              onClick={() => onChangeMode("custom_flow")}
              icon={Workflow}
              title="Mi flow custom"
              desc="El agente sigue el AgentFlow que tengas activo abajo. Total control."
              badge={billing.plan?.features.includes("flow_editor") ? "Pro / Enterprise" : "Upgrade necesario"}
              disabled={!billing.plan?.features.includes("flow_editor") && !billing.is_hibernating}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {flows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
          <Workflow className="w-12 h-12 mx-auto text-gray-300" />
          <h3 className="mt-4 text-gray-700 font-semibold">Aún no tenés flows</h3>
          <p className="mt-1 text-sm text-gray-500">Creá uno para empezar a editar visualmente.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Crear primer flow
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {flows.map((flow) => (
            <div
              key={flow.id}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition ${
                flow.is_active
                  ? "border-emerald-400 bg-emerald-50/40 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {flow.name}
                  </h3>
                  {flow.is_active && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white uppercase tracking-wide">
                      <Play className="w-3 h-3" /> Activo
                    </span>
                  )}
                  <span className="text-xs text-gray-600 font-medium">
                    v{flow.version} · {flow.nodes.length} nodos
                  </span>
                </div>
                {flow.description && (
                  <p className="mt-1.5 text-sm text-gray-700 line-clamp-2">{flow.description}</p>
                )}
                <p className="mt-1.5 text-xs text-gray-500">
                  Actualizado {new Date(flow.updated_at).toLocaleString("es-AR")}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!flow.is_active && (
                  <button
                    onClick={() => onActivate(flow.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
                    title="Activar este flow"
                  >
                    <Play className="w-3.5 h-3.5" /> Activar
                  </button>
                )}
                <Link
                  href={`/app/agent-flows/${flow.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
                >
                  Editar <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => onDelete(flow.id, flow.name)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-gray-200"
                  title="Borrar flow"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && currentStore && (
        <CreateFlowModal
          storeId={currentStore.id}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await reload();
          }}
        />
      )}

      {activatedInfo && (
        <ActivatedModal
          whatsappConnected={activatedInfo.whatsappConnected}
          onClose={() => setActivatedInfo(null)}
        />
      )}

      {aiOpen && currentStore && (
        <GenerateAIModal
          storeId={currentStore.id}
          onClose={() => setAiOpen(false)}
          onGenerated={(flowId) => {
            setAiOpen(false);
            window.location.href = `/app/agent-flows/${flowId}`;
          }}
        />
      )}
    </div>
  );
}


function GenerateAIModal({
  storeId,
  onClose,
  onGenerated,
}: {
  storeId: string;
  onClose: () => void;
  onGenerated: (flowId: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const EXAMPLES = [
    "Vendo ropa urbana. Quiero que el agente recomiende según ocasión, pregunte talle y color, y pase a un humano para cerrar.",
    "Farmacia: el agente debe pedir si tienen receta, verificar stock y coordinar retiro en el local.",
    "Restaurante de delivery: tomar el pedido, sumar bebida, pedir dirección y confirmar el total con envío.",
  ];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError("");
    try {
      const flow = await generateFlow(storeId, prompt.trim());
      onGenerated(flow.id);
    } catch (e: any) {
      setError(e.message || "Error generando el flujo");
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Generar flujo con IA</h3>
              <p className="text-xs text-gray-500">Describí tu negocio y la IA arma el diagrama.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <textarea
            required
            autoFocus
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Vendo zapatillas. Quiero que el agente pregunte qué deporte, recomiende modelos, verifique talle disponible y coordine la compra…"
            className="w-full px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-400"
            disabled={generating}
          />

          <div>
            <p className="text-[11px] text-gray-500 mb-1.5">O probá un ejemplo:</p>
            <div className="space-y-1.5">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={generating}
                  onClick={() => setPrompt(ex)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-violet-50 hover:border-violet-200 disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={generating || prompt.trim().length < 5}
              className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generando flujo…</>
              ) : (
                <><Wand2 className="w-4 h-4" /> Generar</>
              )}
            </button>
          </div>
          {generating && (
            <p className="text-center text-[11px] text-gray-400">Esto puede tardar ~10-20 segundos…</p>
          )}
        </form>
      </div>
    </div>
  );
}


function ActivatedModal({
  whatsappConnected,
  onClose,
}: {
  whatsappConnected: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Flow activado</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Web chat: siempre disponible */}
        <div className="mb-3 flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <strong>Chat web listo.</strong> Tu agente ya responde en el chat de tu tienda.
            Probalo entrando a tu storefront y abriendo el chat.
          </div>
        </div>

        {/* WhatsApp: depende de conexión */}
        {whatsappConnected ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <MessageCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-900">
              <strong>WhatsApp conectado.</strong> El agente también atiende por WhatsApp.
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-300">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <strong>WhatsApp NO conectado.</strong> Para que el agente atienda por WhatsApp:
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-xs">
                <li>Andá a <strong>WhatsApp</strong> en el menú lateral</li>
                <li>Tocá <strong>"Conectar"</strong> y escaneá el QR con tu teléfono</li>
                <li>Una vez conectado, el agente atiende ahí automáticamente</li>
              </ol>
              <Link
                href="/app/whatsapp"
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Ir a conectar WhatsApp
              </Link>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  badge,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Bot;
  title: string;
  desc: string;
  badge: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-4 rounded-xl border-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "border-indigo-600 bg-indigo-50 ring-4 ring-indigo-100 shadow-sm"
          : "border-gray-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${active ? "text-indigo-700" : "text-gray-600"}`} />
          <span className={`text-base font-bold ${active ? "text-indigo-900" : "text-gray-900"}`}>
            {title}
          </span>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${
          active ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"
        }`}>
          {badge}
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-snug">{desc}</p>
      {active && (
        <p className="mt-2 text-xs text-indigo-700 font-bold">✓ Activo ahora</p>
      )}
    </button>
  );
}


/**
 * Template del flow REAL de Agentro — los 9 stages tal cual están en
 * `backend/app/services/stage_agent_seeder.py`. Cada nodo representa un stage
 * del agente, en el orden típico del ciclo de venta completo (incluye cierre
 * autónomo, pago y post-venta).
 *
 * IMPORTANTE: el agente actual es una state machine. El LLM dentro de cada
 * stage decide cuándo llamar la tool `move_stage` para transicionar al
 * siguiente. Las flechas son la transición TÍPICA, no obligada — desde
 * cualquier stage se puede saltar a otro si la conversación lo amerita
 * (ej: de recommendation → directo a closing si el cliente ya decidió).
 *
 * Stages: incoming → discovery → recommendation → validation → closing →
 *          payment → order_created → shipping → completed
 */
// Helpers para armar sub-flujos compactos
let _idc = 0;
const _nid = (p: string) => `${p}-${Date.now()}-${_idc++}`;

function _msg(x: number, y: number, variants: string[]) {
  return { id: _nid("msg"), type: "message", position: { x, y }, data: { variants } };
}
function _wait(x: number, y: number, wait_for: string, mins: number, attempts: number, on_timeout = "escalate") {
  return { id: _nid("wait"), type: "wait", position: { x, y }, data: { wait_for, timeout_minutes: mins, max_attempts: attempts, on_timeout } };
}
function _tool(x: number, y: number, tool_name: string) {
  return { id: _nid("tool"), type: "tool_call", position: { x, y }, data: { tool_name, input: "" } };
}
function _rule(x: number, y: number, rule_kind: string, description: string) {
  return { id: _nid("rule"), type: "rule", position: { x, y }, data: { rule_kind, description, enabled: true } };
}
function _branch(x: number, y: number, branches: { id: string; intent: string; label: string }[]) {
  return { id: _nid("branch"), type: "branch_response", position: { x, y }, data: { branches } };
}
function _collect(x: number, y: number, field: string, prompt: string) {
  return { id: _nid("collect"), type: "collect_data", position: { x, y }, data: { field, prompt } };
}
function _esc(x: number, y: number, reason: string) {
  return { id: _nid("esc"), type: "escalate", position: { x, y }, data: { reason } };
}
function _edge(s: string, t: string, handle?: string) {
  return { id: _nid("e"), source: s, target: t, ...(handle ? { sourceHandle: handle } : {}) };
}

// Devuelve los pasos internos de cada stage como nodos planos posicionados
// en la columna del stage (x), apilados verticalmente (y).
function _stepsFor(stage: string, x: number, yStart: number): { nodes: any[]; edges: any[] } {
  const step = 150;
  let y = yStart;
  const ns: any[] = [];
  const es: any[] = [];
  const push = (node: any) => { ns.push(node); y += step; return node; };
  const chain = () => { for (let i = 0; i < ns.length - 1; i++) es.push(_edge(ns[i].id, ns[i + 1].id)); };

  if (stage === "incoming") {
    push(_msg(x, y, ["¡Hola! ¿En qué te puedo ayudar?", "¡Bienvenido! Contame qué buscás.", "¡Hola! ¿Buscás algo puntual?"]));
    push(_branch(x, y, [
      { id: "b-buy", intent: "wants_to_buy", label: "Quiere comprar" },
      { id: "b-price", intent: "price", label: "Pregunta precio" },
      { id: "b-any", intent: "any", label: "Otra cosa" },
    ]));
    chain();
  } else if (stage === "discovery") {
    push(_msg(x, y, ["Contame, ¿qué buscás? ¿Color, talle, estilo?"]));
    push(_wait(x, y, "customer", 30, 3, "pause"));
    push(_tool(x, y, "product_search"));
    chain();
  } else if (stage === "recommendation") {
    push(_tool(x, y, "recommend_product"));
    push(_msg(x, y, ["Te recomiendo esto: …", "Mirá, esto te sirve: …"]));
    chain();
  } else if (stage === "validation") {
    push(_rule(x, y, "no_confirm_without_supplier", "No confirmar sin validación del proveedor"));
    push(_tool(x, y, "check_availability"));
    push(_wait(x, y, "supplier", 60, 3, "pause"));
    push(_tool(x, y, "estimate_shipping"));
    push(_msg(x, y, ["Confirmado: hay stock y el total con envío es … ¿Avanzamos?"]));
    chain();
  } else if (stage === "closing") {
    push(_rule(x, y, "discounts_from_db_only", "Descuentos solo los de la DB"));
    push(_msg(x, y, ["Resumen de tu pedido: …\n¿Confirmás para el pago?"]));
    push(_tool(x, y, "create_payment_link"));
    push(_wait(x, y, "payment", 120, 3, "escalate"));
    chain();
  } else if (stage === "payment") {
    push(_wait(x, y, "payment", 120, 3, "escalate"));
    push(_tool(x, y, "create_order"));
    push(_msg(x, y, ["¡Pago confirmado! Generando tu orden…"]));
    chain();
  } else if (stage === "order_created") {
    push(_msg(x, y, ["¡Listo! Orden #{order_id} creada. Llega en {eta}."]));
    push(_collect(x, y, "address", "¿Me confirmás la dirección de envío?"));
    chain();
  } else if (stage === "shipping") {
    push(_msg(x, y, ["Tu pedido va en camino 🚚. Seguimiento: {tracking}"]));
    push(_wait(x, y, "delivery", 1440, 3, "escalate"));
    chain();
  } else if (stage === "completed") {
    push(_msg(x, y, ["¡Gracias por tu compra! 🙌 ¿Cómo fue tu experiencia?"]));
    push(_tool(x, y, "recommend_product"));
    chain();
  }
  return { nodes: ns, edges: es };
}

function buildAgentroV2Template() {
  _idc = 0;
  // Los 9 stages reales del agente. Fuente: backend/app/services/stage_agent_seeder.py
  const STAGES = [
    { id: "incoming",       display: "Recepción",       desc: "Saluda y detecta intención",          tools: ["update_notebook", "move_stage", "product_search"] },
    { id: "discovery",      display: "Descubrimiento",  desc: "Explora preferencias y presupuesto",  tools: ["product_search", "product_detail", "update_notebook"] },
    { id: "recommendation", display: "Recomendación",   desc: "Recomienda productos del catálogo",   tools: ["recommend_product", "check_availability", "update_notebook"] },
    { id: "validation",     display: "Validación",      desc: "Verifica stock, precio y envío",      tools: ["check_availability", "estimate_shipping", "move_stage"] },
    { id: "closing",        display: "Cierre",          desc: "Resume pedido + link de pago",        tools: ["create_payment_link", "move_stage"] },
    { id: "payment",        display: "Pago",            desc: "Gestiona pago y crea la orden",       tools: ["create_payment_link", "create_order", "notify_owner"] },
    { id: "order_created",  display: "Orden creada",    desc: "Confirma orden + nº y tiempo",        tools: ["update_notebook", "notify_owner"] },
    { id: "shipping",       display: "Envío",           desc: "Tracking y estado del envío",         tools: ["update_notebook", "notify_owner"] },
    { id: "completed",      display: "Completado",      desc: "Post-venta + cross-sell",             tools: ["recommend_product", "update_notebook"] },
  ];

  const COL_W = 340;   // ancho de columna por stage
  const STAGE_Y = 160; // altura de la fila de etiquetas de stage
  const STEPS_Y = 320; // donde arrancan los pasos de cada stage

  // Trigger arriba a la izquierda
  const triggerId = "tpl-trigger";
  const nodes: any[] = [
    { id: triggerId, type: "trigger", position: { x: 20, y: 20 }, data: { intent: "any", label: "Cualquier mensaje del cliente" } },
  ];
  const edges: any[] = [];

  // Cada stage = una columna: etiqueta arriba + pasos debajo
  STAGES.forEach((s, i) => {
    const x = 20 + i * COL_W;
    const stageNodeId = `stage-${s.id}`;
    nodes.push({
      id: stageNodeId,
      type: "stage",
      position: { x, y: STAGE_Y },
      data: { stage_name: s.id, display_name: s.display, stage_description: s.desc, stage_tools: s.tools },
    });

    // Pasos internos planos en esta columna
    const { nodes: stepNodes, edges: stepEdges } = _stepsFor(s.id, x, STEPS_Y);
    nodes.push(...stepNodes);
    edges.push(...stepEdges);

    // Conectar etiqueta del stage → su primer paso (si tiene)
    if (stepNodes.length > 0) {
      edges.push(_edge(stageNodeId, stepNodes[0].id));
    }

    // Conectar etiqueta de stage anterior → esta (cadena de stages horizontal)
    if (i === 0) {
      edges.push(_edge(triggerId, stageNodeId));
    } else {
      edges.push({ ..._edge(`stage-${STAGES[i - 1].id}`, stageNodeId), label: "move_stage" });
    }
  });

  return { nodes, edges };
}


function CreateFlowModal({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // Seed inicial — un mini-flow funcional para que el user no arranque vacío:
      //   Trigger "saludo" → Mensaje con 2 variantes
      const triggerId = `trigger-${Date.now()}`;
      const msgId = `message-${Date.now() + 1}`;
      await createFlow(storeId, {
        name: name.trim(),
        description: description.trim() || null,
        nodes: [
          {
            id: triggerId,
            type: "trigger",
            position: { x: 250, y: 40 },
            data: { intent: "greeting", label: "Cuando: saludo" },
          },
          {
            id: msgId,
            type: "message",
            position: { x: 250, y: 200 },
            data: {
              variants: [
                "¡Hola! Soy tu asistente. ¿En qué te puedo ayudar?",
                "¡Hola! ¿Buscás algo en particular o querés que te muestre lo más vendido?",
                "¡Buenas! ¿Cómo te puedo ayudar hoy?",
              ],
            },
          },
        ],
        edges: [
          {
            id: `e-${Date.now()}`,
            source: triggerId,
            target: msgId,
          },
        ],
      });
      onCreated();
    } catch (e: any) {
      setError(e.message || "Error creando flow");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuevo flow</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">Nombre</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Flujo de ventas v1"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">Descripción (opcional)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué hace este flow…"
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {submitting ? "Creando…" : "Crear y editar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
