"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import {
  getConversations,
  getConversation,
  parseHandoffSummary,
  type ConversationDetail,
  type HandoffSummary,
} from "@/lib/api/conversations";
import {
  getSalesSession,
  type SalesSessionDetail,
  type NotebookSection,
} from "@/lib/api/sales-sessions";
import {
  listTeamMembers,
  assignConversation,
  takeControl,
  releaseToAgent,
  suggestReply,
  sendManualReply,
  type TeamMember,
} from "@/lib/api/team";
import {
  Loader2,
  MessageSquare,
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Search,
  ShoppingBag,
  DollarSign,
  Truck,
  CreditCard,
  ClipboardList,
  Crosshair,
  Heart,
  Settings2,
  Filter,
  MailOpen,
  UserPlus,
  Hand,
  Bot as BotIcon,
  Inbox,
  Sparkles,
  Send,
  ClipboardCheck,
  ShoppingBag as ShoppingBagIcon,
  Phone,
  MapPin,
  AlertTriangle,
  Flame,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

/* ── Stage config ────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  incoming: "Entrante",
  discovery: "Descubrimiento",
  recommendation: "Recomendacion",
  validation: "Validacion",
  closing: "Cierre",
  payment: "Pago",
  order_created: "Orden Creada",
  shipping: "Envio",
  completed: "Completado",
  lost: "Perdido",
  abandoned: "Abandonado",
};

const STAGE_BADGE_COLORS: Record<string, string> = {
  incoming: "bg-blue-100 text-blue-700",
  discovery: "bg-purple-100 text-purple-700",
  recommendation: "bg-indigo-100 text-indigo-700",
  validation: "bg-amber-100 text-amber-700",
  closing: "bg-orange-100 text-orange-700",
  payment: "bg-yellow-100 text-yellow-700",
  order_created: "bg-emerald-100 text-emerald-700",
  shipping: "bg-cyan-100 text-cyan-700",
  completed: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  abandoned: "bg-gray-100 text-gray-500",
};

/* ── Notebook Collapsible ────────────────────────── */

function NotebookCollapsible({
  title,
  icon: Icon,
  data,
  color,
}: {
  title: string;
  icon: React.ElementType;
  data: Record<string, any>;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const hasData = Object.values(data).some(
    (v) =>
      v !== "" &&
      v !== 0 &&
      v !== false &&
      v !== null &&
      v !== undefined &&
      !(Array.isArray(v) && v.length === 0)
  );

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/80 transition-all duration-200 ${
          hasData ? "text-gray-900" : "text-gray-400"
        }`}
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold flex-1">{title}</span>
        {hasData && (
          <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
        )}
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="mt-3 space-y-2">
            {Object.entries(data).map(([key, value]) => {
              const display =
                typeof value === "object"
                  ? JSON.stringify(value, null, 0)
                  : String(value);
              if (
                !display ||
                display === '""' ||
                display === "0" ||
                display === "false" ||
                display === "[]" ||
                display === "{}"
              )
                return null;
              return (
                <div key={key} className="flex gap-3">
                  <span className="text-[11px] text-gray-400 font-medium min-w-[90px]">
                    {key}:
                  </span>
                  <span className="text-[11px] text-gray-700 break-all leading-relaxed">
                    {display}
                  </span>
                </div>
              );
            })}
            {!hasData && (
              <p className="text-[11px] text-gray-400 italic">Sin datos</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Notebook Panel ──────────────────────────────── */

function NotebookPanel({ notebook }: { notebook: NotebookSection }) {
  const sections = [
    {
      title: "Cliente",
      icon: User,
      data: notebook.customer,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Intencion",
      icon: Crosshair,
      data: notebook.intent,
      color: "bg-purple-100 text-purple-600",
    },
    {
      title: "Interes",
      icon: Heart,
      data: notebook.interest,
      color: "bg-pink-100 text-pink-600",
    },
    {
      title: "Recomendacion",
      icon: Search,
      data: notebook.recommendation,
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      title: "Pricing",
      icon: DollarSign,
      data: notebook.pricing,
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Disponibilidad",
      icon: ShoppingBag,
      data: notebook.availability,
      color: "bg-amber-100 text-amber-600",
    },
    {
      title: "Envio",
      icon: Truck,
      data: notebook.shipping,
      color: "bg-cyan-100 text-cyan-600",
    },
    {
      title: "Pago",
      icon: CreditCard,
      data: notebook.payment,
      color: "bg-yellow-100 text-yellow-600",
    },
    {
      title: "Orden",
      icon: ClipboardList,
      data: notebook.order,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Control del Agente",
      icon: Settings2,
      data: notebook.agent_control,
      color: "bg-gray-200 text-gray-600",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5 px-1 mb-4">
        <div className="p-2 rounded-lg bg-indigo-50">
          <BookOpen className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Sales Notebook</h3>
          <p className="text-[10px] text-gray-400">Datos de la venta</p>
        </div>
      </div>
      {sections.map((s) => (
        <NotebookCollapsible key={s.title} {...s} />
      ))}
    </div>
  );
}

/* ── Conversation List Item ──────────────────────── */

function ConversationItem({
  conv,
  isSelected,
  onClick,
}: {
  conv: ConversationDetail;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lastMsg = conv.messages?.[conv.messages.length - 1];
  const name = conv.customer_name || conv.customer_email || "Cliente";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-gray-50/80 transition-all duration-200 ${
        isSelected
          ? "bg-indigo-50/80 border-l-[3px] border-l-indigo-500"
          : "border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            isSelected
              ? "bg-indigo-100 text-indigo-600"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {name}
            </span>
            {conv.current_stage && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                  STAGE_BADGE_COLORS[conv.current_stage] || "bg-gray-100"
                }`}
              >
                {STAGE_LABELS[conv.current_stage] || conv.current_stage}
              </span>
            )}
          </div>
          {lastMsg && (
            <p className="text-xs text-gray-500 truncate leading-relaxed">
              {lastMsg.role === "assistant" && (
                <Bot className="w-3 h-3 inline mr-1 -mt-0.5" />
              )}
              {lastMsg.content.substring(0, 80)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/* ── Message in conversation detail ──────────────── */

function ConversationMessage({
  msg,
}: {
  msg: { id?: string; role: string; content: string };
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-indigo-600" />
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
      </div>
      {isUser && (
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-gray-600" />
        </div>
      )}
    </div>
  );
}

/* ── Handoff Summary Banner ──────────────────────── */

const PRIORITY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  vip: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", icon: "🔥" },
  alta: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", icon: "🟠" },
  media: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "🟡" },
  baja: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: "🟢" },
};

function HandoffSummaryBanner({
  summary,
  conversationId,
  storeSlug,
}: {
  summary: HandoffSummary;
  conversationId: string;
  storeSlug?: string;
}) {
  const priority = summary.priority || "media";
  const palette = PRIORITY_COLORS[priority] || PRIORITY_COLORS.media;
  const cust = summary.customer || {};
  const interest = summary.interest || {};
  const pricing = summary.pricing || {};
  const products = interest.products || [];
  const objections = summary.objections || [];

  // Construye URL para crear pedido pre-llenado
  const orderQuery = new URLSearchParams();
  if (cust.name) orderQuery.set("customer_name", cust.name);
  if (cust.phone) orderQuery.set("customer_phone", cust.phone);
  if (cust.email) orderQuery.set("customer_email", cust.email);
  if (cust.city) orderQuery.set("city", cust.city);
  if (cust.address) orderQuery.set("address", cust.address);
  if (products.length) orderQuery.set("products", products.join(", "));
  if (pricing.quoted_total) orderQuery.set("total", String(pricing.quoted_total));
  if (interest.quantity) orderQuery.set("quantity", String(interest.quantity));
  orderQuery.set("from_chat", conversationId);

  return (
    <div className={`rounded-xl border ${palette.bg} p-4 m-4 mt-3`}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardCheck className={`w-4 h-4 ${palette.text}`} />
          <span className={`text-xs font-bold uppercase tracking-wide ${palette.text}`}>
            Handoff del agente · prioridad {palette.icon} {priority}
          </span>
        </div>
        <Link
          href={`/app/orders/new?${orderQuery.toString()}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition shadow-sm"
        >
          <ShoppingBagIcon className="w-3.5 h-3.5" />
          Crear pedido
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {/* Cliente */}
        <div className="space-y-1">
          <div className="font-semibold text-gray-700 mb-1">Cliente</div>
          {cust.name && (
            <div className="text-gray-700">
              <span className="text-gray-500">Nombre:</span> {cust.name}
            </div>
          )}
          {cust.phone && (
            <div className="text-gray-700 flex items-center gap-1">
              <Phone className="w-3 h-3 text-gray-400" /> {cust.phone}
            </div>
          )}
          {cust.email && (
            <div className="text-gray-700 truncate">
              <span className="text-gray-500">Email:</span> {cust.email}
            </div>
          )}
          {(cust.city || cust.address) && (
            <div className="text-gray-700 flex items-start gap-1">
              <MapPin className="w-3 h-3 text-gray-400 mt-0.5" />
              <span>
                {[cust.address, cust.city].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {cust.reference && (
            <div className="text-gray-600 italic">Ref: {cust.reference}</div>
          )}
          {cust.observations && (
            <div className="text-gray-600 italic">Obs: {cust.observations}</div>
          )}
        </div>

        {/* Pedido */}
        <div className="space-y-1">
          <div className="font-semibold text-gray-700 mb-1">Pedido</div>
          {products.length > 0 && (
            <div className="text-gray-700">
              <span className="text-gray-500">Productos:</span> {products.join(", ")}
            </div>
          )}
          {interest.quantity != null && (
            <div className="text-gray-700">
              <span className="text-gray-500">Cantidad:</span> {interest.quantity}
            </div>
          )}
          {pricing.quoted_total && (
            <div className="text-gray-900 font-semibold">
              Total: {pricing.quoted_total} {pricing.currency || ""}
            </div>
          )}
          {interest.budget_range && (
            <div className="text-gray-600">
              <span className="text-gray-500">Budget:</span> {interest.budget_range}
            </div>
          )}
        </div>
      </div>

      {/* Objeciones */}
      {objections.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200/60">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-gray-700">Objeciones / dudas:</span>{" "}
              <span className="text-gray-600">{objections.join(" · ")}</span>
            </div>
          </div>
        </div>
      )}

      {summary.additional_info && (
        <div className="mt-2 text-xs text-gray-600 italic">
          📝 {summary.additional_info}
        </div>
      )}
    </div>
  );
}


/* ════════════════════════════════════════════════════ */
/*              CONVERSATIONS PAGE                     */
/* ════════════════════════════════════════════════════ */

export default function ConversationsPage() {
  const { currentStore } = useStore();
  const searchParams = useSearchParams();
  const convIdFromUrl = searchParams.get("conv");

  const [conversations, setConversations] = useState<ConversationDetail[]>([]);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [notebook, setNotebook] = useState<NotebookSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "unassigned" | "mine">("all");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  // Composer manual + copiloto
  const [composerText, setComposerText] = useState("");
  const [copilotHint, setCopilotHint] = useState("");
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoOpenDone = useRef(false);

  const reloadConversations = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const filters =
        assignmentFilter === "unassigned"
          ? { needs_assignment: true }
          : assignmentFilter === "mine"
          ? { assigned_to_me: true }
          : undefined;
      const data = await getConversations(currentStore.id, filters);
      setConversations(data);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentStore) return;
    autoOpenDone.current = false;
    reloadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id, assignmentFilter]);

  // Cargamos los miembros del equipo en paralelo (puede fallar silenciosamente
  // si el usuario no tiene permisos — los sellers no ven equipo).
  useEffect(() => {
    if (!currentStore) return;
    listTeamMembers(currentStore.id)
      .then(setTeamMembers)
      .catch(() => setTeamMembers([]));
  }, [currentStore?.id]);

  // Auto-abrir conversación si viene desde el pipeline con ?conv=
  useEffect(() => {
    if (!convIdFromUrl || !conversations.length || autoOpenDone.current) return;
    const target = conversations.find((c) => c.id === convIdFromUrl);
    if (target) {
      autoOpenDone.current = true;
      selectConversation(target);
    }
  }, [convIdFromUrl, conversations]);

  // Polling: si el agente está pausado (modo manual), refrescar mensajes
  // cada 5s para ver lo que escribe el cliente en tiempo casi real.
  useEffect(() => {
    if (!currentStore || !selected || !selected.agent_paused) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await getConversation(currentStore.id, selected.id);
        // Solo actualizamos si hay cambios reales (más mensajes o pause flip)
        setSelected((prev) => {
          if (!prev) return prev;
          const prevCount = prev.messages?.length || 0;
          const newCount = fresh.messages?.length || 0;
          const pauseChanged = prev.agent_paused !== fresh.agent_paused;
          if (newCount === prevCount && !pauseChanged) return prev;
          return { ...prev, messages: fresh.messages, agent_paused: fresh.agent_paused };
        });
      } catch {
        // Silencioso — no spammear errores en polling
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStore?.id, selected?.id, selected?.agent_paused]);

  const selectConversation = async (conv: ConversationDetail) => {
    if (!currentStore) return;
    setLoadingDetail(true);
    setNotebook(null);
    try {
      const detail = await getConversation(currentStore.id, conv.id);
      setSelected(detail);
      if (detail.session_id) {
        const session = await getSalesSession(
          currentStore.id,
          detail.session_id
        );
        setNotebook(session.notebook || null);
      }
    } catch {
      setSelected(conv);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  /* ── Filtered conversations ────────────────────── */
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      !searchTerm ||
      (conv.customer_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (conv.customer_email || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStage =
      stageFilter === "all" || conv.current_stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  /* ── Active stages for filter ──────────────────── */
  const activeStages = Array.from(
    new Set(conversations.map((c) => c.current_stage).filter(Boolean))
  );

  /* ── Assignment handlers ──────────────────────── */
  const onAssign = async (userId: string | null) => {
    if (!currentStore || !selected) return;
    setAssignmentBusy(true);
    try {
      const r = await assignConversation(currentStore.id, selected.id, userId);
      setSelected({
        ...selected,
        assigned_user_id: r.assigned_user_id,
        assigned_at: r.assigned_at,
        needs_seller_assignment: r.needs_seller_assignment,
      });
      reloadConversations();
    } catch (e: any) {
      alert(e.message || "Error asignando conversación");
    } finally {
      setAssignmentBusy(false);
    }
  };

  const onTakeControl = async () => {
    if (!currentStore || !selected) return;
    setAssignmentBusy(true);
    try {
      const r = await takeControl(currentStore.id, selected.id);
      setSelected({ ...selected, agent_paused: r.agent_paused });
      reloadConversations();
    } catch (e: any) {
      alert(e.message || "Error tomando control");
    } finally {
      setAssignmentBusy(false);
    }
  };

  const onReleaseToAgent = async () => {
    if (!currentStore || !selected) return;
    setAssignmentBusy(true);
    try {
      const r = await releaseToAgent(currentStore.id, selected.id);
      setSelected({ ...selected, agent_paused: r.agent_paused });
      reloadConversations();
    } catch (e: any) {
      alert(e.message || "Error liberando al agente");
    } finally {
      setAssignmentBusy(false);
    }
  };

  const assignedMember = selected?.assigned_user_id
    ? teamMembers.find((m) => m.user_id === selected.assigned_user_id)
    : null;

  /* ── Copilot handlers ─────────────────────────── */
  const onAskCopilot = async () => {
    if (!currentStore || !selected) return;
    setCopilotBusy(true);
    try {
      const r = await suggestReply(currentStore.id, selected.id, copilotHint || undefined);
      setComposerText(r.suggestion);
      setCopilotHint("");
    } catch (e: any) {
      alert(e.message || "Error pidiendo sugerencia");
    } finally {
      setCopilotBusy(false);
    }
  };

  const onSendManual = async () => {
    if (!currentStore || !selected || !composerText.trim()) return;
    setComposerBusy(true);
    try {
      await sendManualReply(currentStore.id, selected.id, composerText.trim());
      setComposerText("");
      // Refrescar el chat para que aparezca el mensaje recién enviado
      const detail = await getConversation(currentStore.id, selected.id);
      setSelected(detail);
    } catch (e: any) {
      alert(e.message || "Error enviando mensaje");
    } finally {
      setComposerBusy(false);
    }
  };

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p className="text-sm">Selecciona una tienda</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            {conversations.length} {conversations.length === 1 ? "conversación" : "conversaciones"}
            {assignmentFilter === "unassigned" && " esperando asignación"}
            {assignmentFilter === "mine" && " asignadas a mí"}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAssignmentFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              assignmentFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setAssignmentFilter("unassigned")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition inline-flex items-center gap-1.5 ${
              assignmentFilter === "unassigned" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Sin asignar
          </button>
          <button
            onClick={() => setAssignmentFilter("mine")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              assignmentFilter === "mine" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            Mis chats
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-5 h-[calc(100%-4.5rem)]">
        {/* ── Left: Conversation list ────────────── */}
        <div className="w-[340px] flex-shrink-0 bg-white rounded-xl border border-gray-200/60 overflow-hidden flex flex-col">
          {/* Search & Filter */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all duration-200"
              />
            </div>
            {activeStages.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div className="flex gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setStageFilter("all")}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-200 ${
                      stageFilter === "all"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    Todas
                  </button>
                  {activeStages.map((stage) => (
                    <button
                      key={stage}
                      onClick={() => setStageFilter(stage!)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all duration-200 ${
                        stageFilter === stage
                          ? STAGE_BADGE_COLORS[stage!] || "bg-gray-200"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {STAGE_LABELS[stage!] || stage}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <MessageSquare className="w-6 h-6 opacity-50" />
                </div>
                <p className="text-sm font-medium mb-1">
                  {searchTerm || stageFilter !== "all"
                    ? "Sin resultados"
                    : "Sin conversaciones"}
                </p>
                <p className="text-xs text-gray-400">
                  {searchTerm || stageFilter !== "all"
                    ? "Prueba con otros filtros"
                    : "Las conversaciones apareceran aqui"}
                </p>
              </div>
            )}
            {filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isSelected={selected?.id === conv.id}
                onClick={() => selectConversation(conv)}
              />
            ))}
          </div>
        </div>

        {/* ── Center: Messages ───────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
                  <MailOpen className="w-7 h-7 opacity-40" />
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">
                  Selecciona una conversacion
                </p>
                <p className="text-xs text-gray-400">
                  Elige una conversacion para ver los mensajes
                </p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <p className="text-xs text-gray-400">Cargando mensajes...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {selected.customer_name ||
                          selected.customer_email ||
                          "Cliente"}
                      </p>
                      {selected.customer_email && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {selected.customer_email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {selected.current_stage && (
                      <span
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                          STAGE_BADGE_COLORS[selected.current_stage] ||
                          "bg-gray-100"
                        }`}
                      >
                        {STAGE_LABELS[selected.current_stage] ||
                          selected.current_stage}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones: asignar + tomar control */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {selected.needs_seller_assignment && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                      <Inbox className="w-3 h-3" />
                      Sin asignar
                    </span>
                  )}

                  {teamMembers.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-gray-400" />
                      <select
                        value={selected.assigned_user_id || ""}
                        disabled={assignmentBusy}
                        onChange={(e) => onAssign(e.target.value || null)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-700 disabled:opacity-50"
                      >
                        <option value="">Sin asignar</option>
                        {teamMembers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name || m.email.split("@")[0]} ({m.role})
                          </option>
                        ))}
                      </select>
                      {assignedMember && (
                        <span className="text-gray-400">
                          → {assignedMember.full_name || assignedMember.email}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex-1" />

                  {selected.agent_paused ? (
                    <button
                      onClick={onReleaseToAgent}
                      disabled={assignmentBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50 font-medium"
                      title="Devolver el control al agente IA"
                    >
                      <BotIcon className="w-3.5 h-3.5" />
                      Devolver al agente
                    </button>
                  ) : (
                    <button
                      onClick={onTakeControl}
                      disabled={assignmentBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50 font-medium"
                      title="Pausar al agente IA y tomar control manual"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      Tomar control
                    </button>
                  )}
                </div>

                {selected.agent_paused && (
                  <div className="mt-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-md text-xs text-emerald-700">
                    🙋 Vos estás manejando esta conversación. El agente IA está pausado.
                  </div>
                )}
              </div>

              {/* Banner del handoff_summary (cuando el agente escaló el chat) */}
              {(() => {
                const summary = parseHandoffSummary(selected.handoff_summary);
                return summary ? (
                  <HandoffSummaryBanner
                    summary={summary}
                    conversationId={selected.id}
                  />
                ) : null;
              })()}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {(selected.messages || []).map((msg, i) => (
                  <ConversationMessage key={msg.id || i} msg={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer manual + copiloto (solo cuando agent_paused) */}
              {selected.agent_paused && (
                <div className="border-t border-gray-200 px-4 py-3 bg-white">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-700">Modo manual</span>
                    <div className="flex-1" />
                    <input
                      type="text"
                      value={copilotHint}
                      onChange={(e) => setCopilotHint(e.target.value)}
                      placeholder="Hint opcional al copiloto…"
                      className="flex-1 min-w-[180px] max-w-xs text-xs px-2.5 py-1.5 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      onClick={onAskCopilot}
                      disabled={copilotBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold disabled:opacity-50 transition"
                      title="Pedir sugerencia al agente IA"
                    >
                      {copilotBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {copilotBusy ? "Pensando…" : "Sugerir respuesta"}
                    </button>
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          if (!composerBusy && composerText.trim()) onSendManual();
                        }
                      }}
                      placeholder="Escribí tu respuesta al cliente…   (Ctrl/⌘ + Enter para enviar)"
                      rows={3}
                      className="flex-1 px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg text-sm resize-y min-h-[72px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      onClick={onSendManual}
                      disabled={composerBusy || !composerText.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shrink-0"
                    >
                      {composerBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Enviar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: Notebook panel ──────────────── */}
        <div className="w-[300px] flex-shrink-0 bg-white rounded-xl border border-gray-200/60 overflow-y-auto p-4">
          {notebook ? (
            <NotebookPanel notebook={notebook} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 opacity-40" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                {selected ? "Sin notebook activo" : "Sales Notebook"}
              </p>
              <p className="text-xs text-gray-400 text-center max-w-[180px]">
                {selected
                  ? "Esta conversacion no tiene notebook"
                  : "Selecciona una conversacion para ver su notebook"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
