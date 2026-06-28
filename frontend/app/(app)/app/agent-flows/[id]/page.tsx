"use client";

/**
 * /app/agent-flows/[id] — Editor visual de un AgentFlow con react-flow.
 *
 * Conceptos del flow:
 *   - TRIGGERS: puntos de entrada. Cada uno matchea un INTENT del cliente
 *     (saludo, pregunta de precio, pregunta de stock, pide humano, etc.).
 *     Si el cliente NO sigue el flujo lineal (ej: pregunta precio antes de
 *     saludar), el agente entra por el trigger correspondiente.
 *   - ACCIONES: lo que ejecuta el agente después de un trigger
 *     (mensaje, condición, tool, escalar, etc.).
 *   - VARIANTES: cada nodo de mensaje puede tener varias versiones del texto.
 *     El agente elige una al azar para que no responda siempre igual.
 *
 * Limitaciones de v1:
 *   - El agent_runtime aún no consume el flow (solo se persiste el diseño).
 *   - No hay validación de flow (triggers huérfanos, nodos desconectados).
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useStore } from "@/lib/context/StoreContext";
import {
  getFlow,
  updateFlow,
  type AgentFlow,
  type FlowNode,
  type FlowEdge,
  type FlowNodeType,
} from "@/lib/api/agent-flows";
import {
  ArrowLeft,
  Save,
  Zap,
  MessageSquare,
  GitBranch,
  GitMerge,
  Wrench,
  UserCheck,
  ClipboardList,
  Clock,
  Trash2,
  Workflow,
  Plus,
  X as XIcon,
  Lightbulb,
  Sparkles,
  Ear,
  Layers,
} from "lucide-react";


// ════════════════════════════════════════════════════════════════════
//  Intents que un trigger puede matchear
// ════════════════════════════════════════════════════════════════════

interface IntentOption {
  value: string;
  label: string;
  emoji: string;
  hint: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  { value: "greeting",       label: "Saludo",                   emoji: "👋", hint: "Cliente saluda (hola, buen día...)" },
  { value: "price",          label: "Pregunta de precio",       emoji: "💰", hint: "Cuánto sale, cuesta, vale..." },
  { value: "stock",          label: "Pregunta de stock",        emoji: "📦", hint: "Tienen, hay, queda, disponibilidad..." },
  { value: "shipping",       label: "Pregunta de envío",        emoji: "🚚", hint: "Envían, costo de envío, llega a..." },
  { value: "discount",       label: "Pregunta de descuento",    emoji: "🏷️", hint: "Promo, oferta, descuento, más barato..." },
  { value: "catalog",        label: "Pide ver catálogo",        emoji: "📋", hint: "Qué tienen, qué venden, mostrame..." },
  { value: "wants_to_buy",   label: "Quiere comprar",           emoji: "🛒", hint: "Lo llevo, lo quiero, confirmar..." },
  { value: "wants_human",    label: "Pide humano",              emoji: "🧑", hint: "Hablar con persona, atención humana..." },
  { value: "any",            label: "Cualquier mensaje (fallback)", emoji: "💬", hint: "Match si ningún otro trigger aplica" },
];

const INTENT_MAP: Record<string, IntentOption> = Object.fromEntries(
  INTENT_OPTIONS.map((i) => [i.value, i]),
);


// ════════════════════════════════════════════════════════════════════
//  Stages reales del agente Agentro (de stage_agent_seeder.py)
// ════════════════════════════════════════════════════════════════════

interface StageOption {
  stage_name: string;
  display_name: string;
  description: string;
  tools: string[];
}

const STAGE_OPTIONS: StageOption[] = [
  { stage_name: "incoming",      display_name: "Recepción",       description: "Saluda y detecta intención inicial",                tools: ["update_notebook", "move_stage", "product_search"] },
  { stage_name: "discovery",     display_name: "Descubrimiento",  description: "Explora preferencias, necesidades y presupuesto",   tools: ["product_search", "product_detail", "update_notebook", "move_stage"] },
  { stage_name: "recommendation",display_name: "Recomendación",   description: "Recomienda productos específicos del catálogo",     tools: ["product_search", "product_detail", "recommend_product", "check_availability", "update_notebook", "move_stage"] },
  { stage_name: "validation",    display_name: "Validación",      description: "Verifica stock, calcula precio total y envío",       tools: ["check_availability", "product_detail", "estimate_shipping", "update_notebook", "move_stage"] },
  { stage_name: "closing",       display_name: "Cierre",          description: "Resume pedido y genera enlace de pago",              tools: ["create_payment_link", "estimate_shipping", "update_notebook", "move_stage"] },
  { stage_name: "payment",       display_name: "Pago",            description: "Gestiona el pago y crea la orden",                   tools: ["create_payment_link", "create_order", "notify_owner", "update_notebook", "move_stage"] },
  { stage_name: "order_created", display_name: "Orden creada",    description: "Confirma orden + da número y tiempo estimado",       tools: ["update_notebook", "move_stage", "notify_owner"] },
  { stage_name: "shipping",      display_name: "Envío",           description: "Info de tracking y estado del envío",                tools: ["update_notebook", "move_stage", "notify_owner"] },
  { stage_name: "completed",     display_name: "Completado",      description: "Post-venta, satisfacción, invitar reseña, cross-sell",tools: ["product_search", "recommend_product", "update_notebook"] },
];

const STAGE_MAP: Record<string, StageOption> = Object.fromEntries(
  STAGE_OPTIONS.map((s) => [s.stage_name, s]),
);


// ════════════════════════════════════════════════════════════════════
//  Catálogo de tipos de nodo
// ════════════════════════════════════════════════════════════════════

interface NodeTypeDef {
  type: FlowNodeType;
  label: string;
  icon: typeof Zap;
  color: string;
  hint: string;
  defaultData: Record<string, any>;
}

const NODE_TYPES: NodeTypeDef[] = [
  {
    type: "trigger",
    label: "Trigger",
    icon: Zap,
    color: "#10b981",
    hint: "Punto de entrada cuando el cliente envía un mensaje de cierto tipo",
    defaultData: { intent: "greeting", label: "Cuando saluda" },
  },
  {
    type: "message",
    label: "Mensaje",
    icon: MessageSquare,
    color: "#3b82f6",
    hint: "Texto que envía el agente. Podés agregar variantes para que no responda igual siempre",
    defaultData: {
      variants: ["¡Hola! ¿En qué te puedo ayudar?"],
    },
  },
  {
    type: "branch_response",
    label: "Esperar respuesta",
    icon: Ear,
    color: "#0d9488",
    hint: "Pausa el flow, espera al cliente, y bifurca según el intent de su respuesta",
    defaultData: {
      branches: [
        { id: "b-price", intent: "price", label: "Pregunta precio" },
        { id: "b-buy", intent: "wants_to_buy", label: "Quiere comprar" },
        { id: "b-any", intent: "any", label: "Cualquier otra cosa" },
      ],
    },
  },
  {
    type: "condition",
    label: "Condición",
    icon: GitBranch,
    color: "#f59e0b",
    hint: "Bifurca el flujo según una regla. Dos salidas: Sí / No",
    defaultData: { condition: "intent == 'compra'", labelYes: "Sí", labelNo: "No" },
  },
  {
    type: "tool_call",
    label: "Tool",
    icon: Wrench,
    color: "#8b5cf6",
    hint: "Ejecuta una herramienta interna (buscar productos, verificar stock, etc.)",
    defaultData: { tool_name: "product_search", input: "" },
  },
  {
    type: "collect_data",
    label: "Pedir dato",
    icon: ClipboardList,
    color: "#6366f1",
    hint: "Le pide al cliente un dato específico (email, teléfono, dirección)",
    defaultData: { field: "email", prompt: "¿Cuál es tu email para mandarte el resumen?" },
  },
  {
    type: "escalate",
    label: "Escalar",
    icon: UserCheck,
    color: "#dc2626",
    hint: "Pasa la conversación a un vendedor humano del equipo",
    defaultData: { reason: "El cliente necesita atención humana" },
  },
  {
    type: "delay",
    label: "Esperar",
    icon: Clock,
    color: "#64748b",
    hint: "Pausa antes del siguiente paso (para que no se vea robótico)",
    defaultData: { seconds: 3 },
  },
  {
    type: "stage",
    label: "Stage del agente",
    icon: Layers,
    color: "#8b5cf6",
    hint: "Una etapa del flujo. Doble-clic para abrir su sub-flujo interno (qué hace el agente dentro de esa etapa).",
    defaultData: {
      stage_name: "incoming",
      display_name: "Recepción",
      stage_description: "Saluda, detecta intención",
      stage_tools: ["update_notebook", "move_stage", "product_search"],
      subflow: { nodes: [], edges: [] },
    },
  },
  {
    type: "wait",
    label: "Esperar (timeout)",
    icon: Clock,
    color: "#0891b2",
    hint: "Espera la respuesta del cliente/proveedor/pago. Configurable en minutos + intentos máximos antes de actuar.",
    defaultData: {
      wait_for: "customer",      // customer | supplier | payment | delivery
      timeout_minutes: 30,
      max_attempts: 3,
      on_timeout: "escalate",    // escalate | continue | pause
    },
  },
  {
    type: "rule",
    label: "Regla dura",
    icon: GitMerge,
    color: "#e11d48",
    hint: "Una regla que el agente SIEMPRE cumple en esta etapa. Podés activarla/desactivarla.",
    defaultData: {
      rule_kind: "no_confirm_without_supplier",
      description: "No confirmar nada sin validación del proveedor",
      enabled: true,
    },
  },
];

// Las 6 reglas duras del diagrama Agentro (para el selector del nodo `rule`)
const RULE_KINDS: { value: string; label: string; description: string }[] = [
  { value: "no_confirm_without_supplier", label: "No confirmar sin proveedor",   description: "No se confirma nada sin validación del proveedor" },
  { value: "discounts_from_db_only",      label: "Descuentos solo de DB",        description: "Descuentos solo los registrados en la DB" },
  { value: "recalc_on_change",            label: "Recalcular si cambia",         description: "Si el cliente cambia algo, se actualiza el contenido y se recalcula" },
  { value: "supplier_silence_wait",       label: "Silencio proveedor → esperar", description: "Si el proveedor no responde, el agente espera. No inventa, no confirma, no escala por silencio" },
  { value: "customer_silence_3_attempts", label: "Silencio cliente → 3 intentos",description: "3 intentos por silencio del cliente, luego se pausa hasta nueva respuesta" },
  { value: "injection_to_escalation",     label: "Injection → escalamiento",     description: "Prompt injection o condiciones fuera de regla → escalamiento automático" },
];
const RULE_KIND_MAP = Object.fromEntries(RULE_KINDS.map((r) => [r.value, r]));

const WAIT_FOR_OPTIONS = [
  { value: "customer", label: "Respuesta del cliente" },
  { value: "supplier", label: "Confirmación del proveedor" },
  { value: "payment",  label: "Confirmación de pago" },
  { value: "delivery", label: "Confirmación de delivery" },
];

const NODE_TYPE_MAP = Object.fromEntries(NODE_TYPES.map((n) => [n.type, n]));


// ════════════════════════════════════════════════════════════════════
//  Custom node component (lo que se ve en el canvas)
// ════════════════════════════════════════════════════════════════════

interface CustomNodeData extends Record<string, unknown> {
  label?: string;
  text?: string;            // legacy — soporte para flows viejos
  variants?: string[];      // nuevo: para mensajes con N variantes
  intent?: string;          // para trigger
  condition?: string;
  tool_name?: string;
  field?: string;
  reason?: string;
  seconds?: number;
  labelYes?: string;
  labelNo?: string;
  branches?: { id: string; intent: string; label: string }[]; // para branch_response
  // Para stage (representa los 9 stages reales del agente)
  stage_name?: string;
  display_name?: string;
  stage_description?: string;
  stage_tools?: string[];
  subflow?: { nodes: any[]; edges: any[] }; // sub-flujo interno del stage
  // Para wait
  wait_for?: string;
  timeout_minutes?: number;
  max_attempts?: number;
  on_timeout?: string;
  // Para rule
  rule_kind?: string;
  description?: string;
  enabled?: boolean;
}

function CustomNode({ data, type, selected }: NodeProps) {
  const def = NODE_TYPE_MAP[type as FlowNodeType];
  if (!def) {
    return (
      <div className="px-3 py-2 rounded-lg border-2 border-gray-300 bg-white text-xs text-gray-700">
        Nodo desconocido: {type}
      </div>
    );
  }
  const Icon = def.icon;
  const d = data as CustomNodeData;

  const isCondition = type === "condition";
  const isTrigger = type === "trigger";
  const isEscalate = type === "escalate";
  const isBranchResponse = type === "branch_response";

  // BRANCH_RESPONSE tiene render especial (N handles dinámicos)
  if (isBranchResponse) {
    const branches = d.branches ?? [];
    return (
      <div
        className={`min-w-[240px] max-w-[300px] rounded-xl border-2 bg-white shadow-sm transition ${
          selected ? "shadow-lg ring-2 ring-indigo-400" : ""
        }`}
        style={{ borderColor: def.color }}
      >
        <Handle type="target" position={Position.Top} style={{ background: def.color, width: 10, height: 10 }} />
        <div
          className="px-3 py-1.5 rounded-t-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: def.color }}
        >
          <Icon className="w-3.5 h-3.5" />
          {def.label}
          <span className="ml-auto text-[10px] opacity-80">{branches.length} ramas</span>
        </div>
        <div className="py-2">
          {branches.length === 0 ? (
            <div className="px-3 text-xs text-gray-400 italic">Sin ramas configuradas</div>
          ) : (
            branches.map((b, i) => {
              const intent = INTENT_MAP[b.intent] ?? INTENT_MAP["any"];
              return (
                <div key={b.id} className="relative px-3 py-1 text-xs text-gray-700 flex items-center gap-1.5">
                  <span>{intent.emoji}</span>
                  <span className="truncate">{b.label || intent.label}</span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={b.id}
                    style={{ background: def.color, width: 9, height: 9, right: -5, top: "50%" }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // STAGE — etiqueta de sección con sus tools (cabecera de cada etapa del flujo)
  if (type === "stage") {
    const tools = d.stage_tools ?? [];
    return (
      <div
        className={`min-w-[230px] max-w-[290px] rounded-xl border-2 bg-violet-50 shadow-sm transition ${
          selected ? "shadow-lg ring-2 ring-violet-400" : ""
        }`}
        style={{ borderColor: def.color }}
      >
        <Handle type="target" position={Position.Top} style={{ background: def.color, width: 10, height: 10 }} />
        <div
          className="px-3 py-1.5 rounded-t-lg text-xs font-bold text-white flex items-center gap-1.5"
          style={{ background: def.color }}
        >
          <Layers className="w-3.5 h-3.5" />
          {d.display_name ?? d.stage_name ?? "Stage"}
          <span className="ml-auto text-[10px] opacity-80 font-mono">{d.stage_name}</span>
        </div>
        <div className="px-3 py-2 text-[11px] text-gray-700">
          <div className="leading-snug mb-2">{d.stage_description}</div>
          {tools.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tools.map((t) => (
                <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-200 text-violet-800 text-[9px] font-mono">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <Handle type="source" position={Position.Bottom} style={{ background: def.color, width: 10, height: 10 }} />
      </div>
    );
  }

  // RULE — chip de regla dura (activable)
  if (type === "rule") {
    const rk = RULE_KIND_MAP[d.rule_kind ?? ""] ?? null;
    const enabled = d.enabled !== false;
    return (
      <div
        className={`min-w-[200px] max-w-[260px] rounded-xl border-2 shadow-sm transition ${
          selected ? "shadow-lg ring-2 ring-rose-400" : ""
        } ${enabled ? "bg-rose-50" : "bg-gray-100 opacity-70"}`}
        style={{ borderColor: enabled ? def.color : "#cbd5e1" }}
      >
        <Handle type="target" position={Position.Top} style={{ background: def.color, width: 10, height: 10 }} />
        <div
          className="px-3 py-1.5 rounded-t-lg text-xs font-semibold text-white flex items-center gap-1.5"
          style={{ background: enabled ? def.color : "#94a3b8" }}
        >
          <GitMerge className="w-3.5 h-3.5" />
          Regla {enabled ? "" : "(off)"}
        </div>
        <div className="px-3 py-2 text-[11px] text-gray-800 leading-snug">
          {rk?.description ?? d.description ?? "Regla sin definir"}
        </div>
        <Handle type="source" position={Position.Bottom} style={{ background: def.color, width: 10, height: 10 }} />
      </div>
    );
  }

  // Preview del contenido del nodo según su tipo
  const preview = (() => {
    if (type === "trigger") {
      const intent = INTENT_MAP[d.intent ?? "any"] ?? INTENT_MAP["any"];
      return `${intent.emoji} ${intent.label}`;
    }
    if (type === "message") {
      const variants = (d.variants && d.variants.length > 0) ? d.variants : (d.text ? [d.text] : []);
      if (variants.length === 0) return "(sin texto)";
      const first = variants[0] ?? "";
      const more = variants.length > 1 ? ` · +${variants.length - 1} variante${variants.length > 2 ? "s" : ""}` : "";
      return first.length > 60 ? first.slice(0, 60) + "…" + more : first + more;
    }
    if (type === "condition") return d.condition ?? "(sin condición)";
    if (type === "tool_call") return d.tool_name ?? "(sin tool)";
    if (type === "collect_data") return d.field ?? "(sin campo)";
    if (type === "escalate") return d.reason ?? "Escalar";
    if (type === "delay") return `${d.seconds ?? 0}s`;
    if (type === "wait") {
      const wf = WAIT_FOR_OPTIONS.find((o) => o.value === d.wait_for)?.label ?? "respuesta";
      return `⏱ ${wf} · ${d.timeout_minutes ?? 30}min · ${d.max_attempts ?? 3} intentos`;
    }
    return "";
  })();

  return (
    <div
      className={`min-w-[200px] max-w-[280px] rounded-xl border-2 bg-white shadow-sm transition ${
        selected ? "shadow-lg ring-2 ring-indigo-400" : ""
      }`}
      style={{ borderColor: def.color }}
    >
      {/* Handle entrada (todos menos trigger) */}
      {!isTrigger && (
        <Handle type="target" position={Position.Top} style={{ background: def.color, width: 10, height: 10 }} />
      )}

      <div
        className="px-3 py-1.5 rounded-t-lg text-xs font-semibold text-white flex items-center gap-1.5"
        style={{ background: def.color }}
      >
        <Icon className="w-3.5 h-3.5" />
        {def.label}
        {isTrigger && d.intent && (
          <span className="ml-auto text-[10px] opacity-80">entrada</span>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-gray-800 break-words leading-snug">
        {preview}
      </div>

      {/* Handle salida: condition tiene 2, escalate ninguno, los demás 1 */}
      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ background: "#10b981", width: 10, height: 10, left: "30%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ background: "#94a3b8", width: 10, height: 10, left: "70%" }}
          />
          <div className="flex justify-around text-[10px] text-gray-500 pb-1 px-2 font-medium">
            <span>{d.labelYes ?? "Sí"}</span>
            <span>{d.labelNo ?? "No"}</span>
          </div>
        </>
      ) : !isEscalate ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: def.color, width: 10, height: 10 }}
        />
      ) : null}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
//  Page wrapper
// ════════════════════════════════════════════════════════════════════

export default function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}


// ════════════════════════════════════════════════════════════════════
//  Editor principal
// ════════════════════════════════════════════════════════════════════

function FlowEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { currentStore } = useStore();

  const [flow, setFlow] = useState<AgentFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodeTypes = useMemo(
    () => Object.fromEntries(NODE_TYPES.map((n) => [n.type, CustomNode])),
    [],
  );

  // Cargar flow (vista plana: todos los nodos en un solo canvas)
  useEffect(() => {
    if (!currentStore?.id || !params?.id) return;
    setLoading(true);
    getFlow(currentStore.id, params.id)
      .then((f) => {
        setFlow(f);
        setNodes(f.nodes.map((n) => ({ ...n, type: n.type ?? "message" })) as Node[]);
        setEdges(f.edges as Edge[]);
        setError("");
      })
      .catch((e) => setError(e.message || "Error cargando flow"))
      .finally(() => setLoading(false));
  }, [currentStore?.id, params?.id, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: `e-${Date.now()}` }, eds));
    },
    [setEdges],
  );

  const addNode = (def: NodeTypeDef) => {
    const id = `${def.type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type: def.type,
      position: { x: 250 + Math.random() * 200, y: 180 + Math.random() * 120 },
      data: JSON.parse(JSON.stringify(def.defaultData)), // deep copy
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const updateSelectedNodeData = (key: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, [key]: value } }
          : n,
      ),
    );
  };

  const onSave = async () => {
    if (!currentStore?.id || !flow) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateFlow(currentStore.id, flow.id, {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type ?? "message",
          position: n.position,
          data: n.data as Record<string, any>,
          ...(n.parentId ? { parentId: n.parentId, extent: n.extent } : {}),
          ...(n.style ? { style: n.style } : {}),
        })) as any,
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: typeof e.label === "string" ? e.label : undefined,
        })) as FlowEdge[],
      });
      setFlow(updated);
      setSavedAt(new Date());
    } catch (e: any) {
      setError(e.message || "Error guardando flow");
    } finally {
      setSaving(false);
    }
  };

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  // Cuántos triggers tiene el flow + sus intents (para el banner de info)
  const triggers = nodes.filter((n) => n.type === "trigger");
  const triggerIntents = new Set(
    triggers.map((n) => ((n.data as CustomNodeData).intent ?? "any")),
  );

  // Palette completa: todos los bloques disponibles en un único canvas plano
  const paletteEntries = NODE_TYPES;

  if (loading) {
    return <div className="py-12 text-center text-gray-400">Cargando flow…</div>;
  }
  if (error && !flow) {
    return (
      <div className="py-12">
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg max-w-xl">
          {error}
        </div>
        <button
          onClick={() => router.push("/app/agent-flows")}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg text-gray-700 bg-white"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/app/agent-flows")}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-indigo-600" />
              <h1 className="text-sm font-semibold text-gray-900 truncate">{flow?.name}</h1>
              {flow?.is_active && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                  Activo
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              v{flow?.version} · {triggers.length} trigger{triggers.length === 1 ? "" : "s"} · {nodes.length} nodos · {edges.length} conexiones
              {savedAt && ` · guardado ${savedAt.toLocaleTimeString("es-AR")}`}
            </p>
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {/* Tutorial banner */}
      {showTutorial && (
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-indigo-100 px-4 py-3 flex items-start gap-3 text-xs text-indigo-900">
          <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-600" />
          <div className="flex-1 leading-relaxed">
            <strong>Cómo funciona este editor:</strong> Todo el flujo del agente se ve de una sola vez. El cliente NO siempre saluda primero — a veces pregunta directo "¿cuánto sale?", "¿tienen X?". Por eso tenés <strong>triggers</strong> (entradas por intent) y nodos de <strong>mensaje</strong> con variantes para que no responda igual siempre.
          </div>
          <button onClick={() => setShowTutorial(false)} className="p-1 text-indigo-500 hover:text-indigo-700">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Cuerpo: palette · canvas · inspector */}
      <div className="flex-1 flex min-h-0">
        {/* ─── Palette ─── */}
        <aside className="w-48 border-r border-gray-200 bg-gray-50 p-3 overflow-y-auto">
          <h3 className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-2">
            Bloques del flujo
          </h3>
          <div className="space-y-1.5">
            {paletteEntries.map((def) => {
              const Icon = def.icon;
              return (
                <button
                  key={def.type}
                  onClick={() => addNode(def)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50"
                  title={def.hint}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: def.color }} />
                  {def.label}
                </button>
              );
            })}
          </div>

          {/* Intents cubiertos */}
          {triggers.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-2">
                Intents cubiertos
              </h3>
              <div className="flex flex-wrap gap-1">
                {Array.from(triggerIntents).map((iv) => {
                  const i = INTENT_MAP[iv] ?? INTENT_MAP["any"];
                  return (
                    <span
                      key={iv}
                      className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700"
                    >
                      {i.emoji} {i.label}
                    </span>
                  );
                })}
              </div>
              {!triggerIntents.has("any") && (
                <p className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-tight">
                  💡 Te falta un trigger <strong>"Cualquier mensaje"</strong> como fallback por si el cliente dice algo que no matchea con los otros.
                </p>
              )}
            </div>
          )}
        </aside>

        {/* ─── Canvas react-flow ─── */}
        <div className="flex-1 min-w-0 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{
              animated: true,
              style: { strokeWidth: 2, stroke: "#94a3b8" },
            }}
          >
            <Background gap={16} color="#e2e8f0" />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>

        {/* ─── Inspector ─── */}
        <aside className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto">
          {selectedNode ? (
            <NodeInspector
              node={selectedNode}
              onUpdate={updateSelectedNodeData}
              onDelete={deleteSelectedNode}
            />
          ) : (
            <div className="text-center mt-12 text-gray-500">
              <Sparkles className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs">Click en un nodo para editarlo</p>
              <p className="mt-3 text-[11px] text-gray-400 leading-relaxed px-2">
                Arrastrá nodos desde el panel izquierdo. Conectalos arrastrando desde el borde inferior de uno hacia el borde superior de otro.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
//  Inspector — edita la `data` del nodo seleccionado
// ════════════════════════════════════════════════════════════════════

function NodeInspector({
  node,
  onUpdate,
  onDelete,
}: {
  node: Node;
  onUpdate: (key: string, value: any) => void;
  onDelete: () => void;
}) {
  const def = NODE_TYPE_MAP[node.type as FlowNodeType];
  const Icon = def?.icon ?? Workflow;
  const data = node.data as CustomNodeData;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded text-white text-xs font-semibold mb-2"
        style={{ background: def?.color ?? "#64748b" }}
      >
        <Icon className="w-3.5 h-3.5" />
        {def?.label ?? node.type}
      </div>
      <p className="text-[11px] text-gray-500 leading-snug mb-4">{def?.hint}</p>

      <div className="space-y-4">
        {/* TRIGGER — selector de intent */}
        {node.type === "trigger" && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-1.5">
                ¿Qué intent del cliente activa este trigger?
              </label>
              <div className="space-y-1">
                {INTENT_OPTIONS.map((opt) => {
                  const selected = data.intent === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onUpdate("intent", opt.value);
                        onUpdate("label", `Cuando: ${opt.label.toLowerCase()}`);
                      }}
                      className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg border text-xs transition ${
                        selected
                          ? "bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base leading-none mt-0.5">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${selected ? "text-emerald-900" : "text-gray-800"}`}>
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-gray-500 leading-snug">
                          {opt.hint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* MESSAGE — variantes */}
        {node.type === "message" && (
          <VariantsEditor
            variants={data.variants ?? (data.text ? [data.text] : [""])}
            onChange={(v) => {
              onUpdate("variants", v);
              // Limpiar el legacy `text` para no confundir
              onUpdate("text", undefined);
            }}
          />
        )}

        {/* BRANCH_RESPONSE — editar ramas */}
        {node.type === "branch_response" && (
          <BranchesEditor
            branches={data.branches ?? []}
            onChange={(b) => onUpdate("branches", b)}
          />
        )}

        {/* STAGE — selector de stage real del agente */}
        {node.type === "stage" && (
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              ¿Qué stage del agente representa este nodo?
            </label>
            <p className="text-[10px] text-gray-500 mb-2 leading-snug">
              Los 9 stages reales del agente Agentro. Cada uno tiene su propio prompt y tools.
            </p>
            <div className="space-y-1">
              {STAGE_OPTIONS.map((s, i) => {
                const selected = data.stage_name === s.stage_name;
                return (
                  <button
                    key={s.stage_name}
                    type="button"
                    onClick={() => {
                      onUpdate("stage_name", s.stage_name);
                      onUpdate("display_name", s.display_name);
                      onUpdate("stage_description", s.description);
                      onUpdate("stage_tools", s.tools);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs transition ${
                      selected
                        ? "bg-violet-50 border-violet-300 ring-1 ring-violet-300"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`font-medium ${selected ? "text-violet-900" : "text-gray-800"}`}>
                      {i + 1}. {s.display_name} <span className="text-[10px] font-mono text-gray-400">({s.stage_name})</span>
                    </div>
                    <div className="text-[10px] text-gray-500 leading-snug">{s.description}</div>
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-[10px] text-gray-500 leading-snug">
              Esta etiqueta marca la etapa. Conectá debajo los pasos (mensajes, validaciones, esperas, reglas) que el agente hace en esta etapa.
            </p>
          </div>
        )}

        {/* WAIT — espera con timeout */}
        {node.type === "wait" && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-1">¿Qué está esperando?</label>
              <select
                value={(data.wait_for as string) ?? "customer"}
                onChange={(e) => onUpdate("wait_for", e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-white text-gray-900 border border-gray-200 rounded-lg"
              >
                {WAIT_FOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Field
              label="Timeout (minutos)"
              value={String(data.timeout_minutes ?? 30)}
              onChange={(v) => onUpdate("timeout_minutes", parseInt(v, 10) || 0)}
              type="number"
              hint="Cuánto espera antes de actuar"
            />
            <Field
              label="Intentos máximos"
              value={String(data.max_attempts ?? 3)}
              onChange={(v) => onUpdate("max_attempts", parseInt(v, 10) || 1)}
              type="number"
              hint="Cuántas veces reintenta antes del timeout"
            />
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-1">Al agotar intentos</label>
              <select
                value={(data.on_timeout as string) ?? "escalate"}
                onChange={(e) => onUpdate("on_timeout", e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-white text-gray-900 border border-gray-200 rounded-lg"
              >
                <option value="escalate">Escalar a humano</option>
                <option value="pause">Pausar (esperar indefinido)</option>
                <option value="continue">Continuar igual</option>
              </select>
            </div>
          </>
        )}

        {/* RULE — regla dura activable */}
        {node.type === "rule" && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-1">Tipo de regla</label>
              <div className="space-y-1">
                {RULE_KINDS.map((r) => {
                  const selected = data.rule_kind === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        onUpdate("rule_kind", r.value);
                        onUpdate("description", r.description);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs transition ${
                        selected ? "bg-rose-50 border-rose-300 ring-1 ring-rose-300" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`font-medium ${selected ? "text-rose-900" : "text-gray-800"}`}>{r.label}</div>
                      <div className="text-[10px] text-gray-500 leading-snug">{r.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.enabled !== false}
                onChange={(e) => onUpdate("enabled", e.target.checked)}
                className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-gray-700">Regla activa</span>
            </label>
          </>
        )}

        {/* CONDITION */}
        {node.type === "condition" && (
          <>
            <Field
              label="Condición lógica"
              value={(data.condition as string) ?? ""}
              onChange={(v) => onUpdate("condition", v)}
              hint="ej: intent == 'compra' && customer.has_history"
            />
            <Field
              label="Label rama YES"
              value={(data.labelYes as string) ?? "Sí"}
              onChange={(v) => onUpdate("labelYes", v)}
            />
            <Field
              label="Label rama NO"
              value={(data.labelNo as string) ?? "No"}
              onChange={(v) => onUpdate("labelNo", v)}
            />
          </>
        )}

        {/* TOOL CALL */}
        {node.type === "tool_call" && (
          <>
            <Field
              label="Tool name"
              value={(data.tool_name as string) ?? ""}
              onChange={(v) => onUpdate("tool_name", v)}
              hint="product_search | check_availability | check_shipping | ..."
            />
            <Field
              label="Input (JSON)"
              value={(data.input as string) ?? ""}
              onChange={(v) => onUpdate("input", v)}
              textarea
              rows={3}
            />
          </>
        )}

        {/* COLLECT DATA */}
        {node.type === "collect_data" && (
          <>
            <Field
              label="Campo a recolectar"
              value={(data.field as string) ?? ""}
              onChange={(v) => onUpdate("field", v)}
              hint="email | phone | address | name | ..."
            />
            <Field
              label="Texto que se le muestra al cliente"
              value={(data.prompt as string) ?? ""}
              onChange={(v) => onUpdate("prompt", v)}
              textarea
              rows={3}
            />
          </>
        )}

        {/* ESCALATE */}
        {node.type === "escalate" && (
          <Field
            label="Razón del escalamiento"
            value={(data.reason as string) ?? ""}
            onChange={(v) => onUpdate("reason", v)}
            textarea
            rows={4}
            hint="El vendedor humano va a ver esto cuando reciba el chat"
          />
        )}

        {/* DELAY */}
        {node.type === "delay" && (
          <Field
            label="Segundos a esperar"
            value={String(data.seconds ?? 3)}
            onChange={(v) => onUpdate("seconds", parseInt(v, 10) || 0)}
            type="number"
            hint="3-5 segundos suele ser realista (como si estuviera tipeando)"
          />
        )}

        <div className="pt-3 border-t border-gray-100">
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Borrar nodo
          </button>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
//  VariantsEditor — array de textos editable
// ════════════════════════════════════════════════════════════════════

function BranchesEditor({
  branches,
  onChange,
}: {
  branches: { id: string; intent: string; label: string }[];
  onChange: (b: { id: string; intent: string; label: string }[]) => void;
}) {
  const update = (i: number, patch: Partial<{ intent: string; label: string }>) => {
    const next = [...branches];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(branches.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...branches,
      { id: `b-${Date.now()}`, intent: "any", label: "Nueva rama" },
    ]);

  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-700 mb-1">
        Ramas por intent del cliente
      </label>
      <p className="text-[10px] text-gray-500 mb-2 leading-snug">
        Cada rama matchea un intent. El cliente responde → el agente entra por la rama que mejor matchea.
      </p>

      <div className="space-y-2">
        {branches.map((b, i) => {
          const intent = INTENT_MAP[b.intent] ?? INTENT_MAP["any"];
          return (
            <div key={b.id} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-gray-700">
                  Rama {i + 1}: {intent.emoji} {intent.label}
                </span>
                <button
                  onClick={() => remove(i)}
                  className="p-0.5 text-gray-400 hover:text-red-500"
                  title="Borrar rama"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
              <select
                value={b.intent}
                onChange={(e) => update(i, { intent: e.target.value })}
                className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-200 rounded mb-1.5"
              >
                {INTENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={b.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label de la rama"
                className="w-full px-2 py-1 text-xs bg-white text-gray-900 border border-gray-200 rounded"
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"
      >
        <Plus className="w-3 h-3" /> Agregar rama
      </button>
    </div>
  );
}


function VariantsEditor({
  variants,
  onChange,
}: {
  variants: string[];
  onChange: (variants: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...variants];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => {
    onChange(variants.filter((_, idx) => idx !== i));
  };
  const add = () => onChange([...variants, ""]);

  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-700 mb-1">
        Variantes del mensaje
      </label>
      <p className="text-[10px] text-gray-500 mb-2 leading-snug">
        El agente elegirá UNA al azar cada vez. Así no responde siempre igual.
      </p>

      <div className="space-y-2">
        {variants.length === 0 && (
          <p className="text-[11px] text-gray-400 italic px-1">Sin variantes — agregá la primera.</p>
        )}
        {variants.map((v, i) => (
          <div key={i} className="relative">
            <textarea
              value={v}
              rows={2}
              onChange={(e) => update(i, e.target.value)}
              placeholder={i === 0 ? "Ej: ¡Hola! ¿En qué te ayudo?" : `Variante ${i + 1}…`}
              className="w-full px-2 py-1.5 pr-7 text-xs bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
            />
            {variants.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 p-0.5 text-gray-300 hover:text-red-500"
                title="Eliminar variante"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"
      >
        <Plus className="w-3 h-3" />
        Agregar variante
      </button>
    </div>
  );
}


function Field({
  label,
  value,
  onChange,
  textarea,
  rows = 3,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-white text-gray-900 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
        />
      )}
      {hint && <p className="mt-1 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}
