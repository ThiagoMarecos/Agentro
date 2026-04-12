/**
 * Agent system constants.
 * Single source of truth for stages, tools, labels, and colors.
 * When the full agentic system is integrated, extend these maps — every component reads from here.
 */

/* ── Pipeline Stages ─────────────────────────────── */

export const STAGES = [
  "incoming",
  "discovery",
  "recommendation",
  "validation",
  "closing",
  "payment",
  "order_created",
  "shipping",
  "completed",
] as const;

export type StageName = (typeof STAGES)[number];

export const TERMINAL_STAGES = ["lost", "abandoned"] as const;

export const STAGE_LABELS: Record<string, string> = {
  incoming: "Recepcion",
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

export const STAGE_DESCRIPTIONS: Record<string, string> = {
  incoming: "Recibe al cliente, saluda y detecta intencion inicial",
  discovery: "Explora necesidades, preferencias y presupuesto",
  recommendation: "Recomienda productos basandose en el descubrimiento",
  validation: "Verifica stock, confirma seleccion, prepara cierre",
  closing: "Resume orden, confirma compra, genera link de pago",
  payment: "Gestiona el proceso de pago y confirma transaccion",
  order_created: "Confirma orden y provee detalles de seguimiento",
  shipping: "Informa estado de envio y tracking",
  completed: "Seguimiento post-venta, satisfaccion, upselling",
};

export const STAGE_COLORS: Record<
  string,
  { border: string; bg: string; text: string; icon: string; dot: string }
> = {
  incoming: {
    border: "border-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    icon: "bg-blue-100 text-blue-600",
    dot: "bg-blue-500",
  },
  discovery: {
    border: "border-purple-500",
    bg: "bg-purple-50",
    text: "text-purple-700",
    icon: "bg-purple-100 text-purple-600",
    dot: "bg-purple-500",
  },
  recommendation: {
    border: "border-indigo-500",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    icon: "bg-indigo-100 text-indigo-600",
    dot: "bg-indigo-500",
  },
  validation: {
    border: "border-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: "bg-amber-100 text-amber-600",
    dot: "bg-amber-500",
  },
  closing: {
    border: "border-orange-500",
    bg: "bg-orange-50",
    text: "text-orange-700",
    icon: "bg-orange-100 text-orange-600",
    dot: "bg-orange-500",
  },
  payment: {
    border: "border-yellow-500",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    icon: "bg-yellow-100 text-yellow-600",
    dot: "bg-yellow-500",
  },
  order_created: {
    border: "border-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: "bg-emerald-100 text-emerald-600",
    dot: "bg-emerald-500",
  },
  shipping: {
    border: "border-cyan-500",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    icon: "bg-cyan-100 text-cyan-600",
    dot: "bg-cyan-500",
  },
  completed: {
    border: "border-green-500",
    bg: "bg-green-50",
    text: "text-green-700",
    icon: "bg-green-100 text-green-600",
    dot: "bg-green-500",
  },
};

/* ── Tools ────────────────────────────────────────── */

export const ALL_TOOLS = [
  "product_search",
  "product_detail",
  "check_availability",
  "recommend_product",
  "estimate_shipping",
  "create_payment_link",
  "create_order",
  "update_notebook",
  "move_stage",
  "notify_owner",
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];

export const TOOL_LABELS: Record<string, string> = {
  product_search: "Buscar productos",
  product_detail: "Detalle de producto",
  check_availability: "Verificar stock",
  recommend_product: "Recomendar productos",
  estimate_shipping: "Estimar envio",
  create_payment_link: "Crear link de pago",
  create_order: "Crear orden",
  update_notebook: "Actualizar notebook",
  move_stage: "Cambiar etapa",
  notify_owner: "Notificar dueno",
};

export const TOOL_CATEGORIES: Record<string, { label: string; tools: string[] }> = {
  products: {
    label: "Productos",
    tools: ["product_search", "product_detail", "check_availability", "recommend_product"],
  },
  orders: {
    label: "Ordenes y Pagos",
    tools: ["estimate_shipping", "create_payment_link", "create_order"],
  },
  system: {
    label: "Sistema",
    tools: ["update_notebook", "move_stage", "notify_owner"],
  },
};

/* ── Agent Config Defaults ────────────────────────── */

export const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
] as const;

export const TONE_OPTIONS = [
  { value: "friendly", label: "Amigable" },
  { value: "professional", label: "Profesional" },
  { value: "casual", label: "Casual" },
] as const;

export const SALES_STYLE_OPTIONS = [
  { value: "consultative", label: "Consultivo" },
  { value: "aggressive", label: "Agresivo" },
  { value: "soft", label: "Suave" },
] as const;
