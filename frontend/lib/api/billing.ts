import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// ─── Types ───────────────────────────────────────────────

export type SubscriptionTier = "starter" | "pro" | "enterprise";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused";

export type FeatureKey =
  | "web_chat"
  | "ai_agent_pretrained"
  | "handoff_human"
  | "whatsapp"
  | "guided_personalization"
  | "copilot_mode"
  | "custom_prompt"
  | "flow_editor"
  | "rag_training"
  | "api_access"
  | "white_label";

export interface StoreFeatures {
  available: FeatureKey[];
  all_keys: FeatureKey[];
  is_hibernating: boolean;
  tier: SubscriptionTier;
  is_beta_user: boolean;
}

export interface PlanDTO {
  tier: SubscriptionTier;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  setup_fee_cents: number;
  store_price_monthly_cents: number;
  seller_extra_price_monthly_cents: number;
  conversation_overage_price_cents: number;
  conversations_included_per_month: number;
  sellers_included: number;
  allow_extra_sellers: boolean;
  features: FeatureKey[];
  is_active: boolean;
  sort_order: number;
}

export type AgentMode = "pretrained" | "custom_flow";

export interface BillingSummary {
  is_hibernating: boolean;
  tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  agent_mode: AgentMode;
  plan: PlanDTO | null;
  trial: {
    active: boolean;
    ends_at: string | null;
  };
  beta: {
    is_beta_user: boolean;
    active: boolean;
    features_until: string | null;
  };
  usage: {
    sellers_current: number;
    sellers_included: number;
    sellers_max: number;
    conversations_included_per_month: number;
  };
}

// ─── Auth helpers ───────────────────────────────────────

async function authFetch(path: string, storeId: string, options: RequestInit = {}) {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ─── API calls ──────────────────────────────────────────

/** Features disponibles para la store actual. */
export async function getStoreFeatures(storeId: string): Promise<StoreFeatures> {
  return authFetch("/billing/features", storeId);
}

/** Resumen completo del estado de billing de la store. */
export async function getBillingSummary(storeId: string): Promise<BillingSummary> {
  return authFetch("/billing/me", storeId);
}

/** Catálogo público de planes (sin auth requerido). */
export async function listPlans(): Promise<{ plans: PlanDTO[] }> {
  const res = await fetch(`${API_URL}/billing/plans`);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

/** Cambia el modo del agente: 'pretrained' (default Agentro) o 'custom_flow' (sigue AgentFlow activo). */
export async function setAgentMode(storeId: string, mode: AgentMode): Promise<{ agent_mode: AgentMode }> {
  return authFetch("/billing/agent-mode", storeId, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

// ─── Display helpers ────────────────────────────────────

export function centsToUsd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function centsToUsdInt(cents: number): string {
  return Math.round(cents / 100).toString();
}

export function tierDisplayName(tier: SubscriptionTier): string {
  return { starter: "Starter", pro: "Pro", enterprise: "Enterprise" }[tier];
}
