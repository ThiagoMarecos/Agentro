import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
}

export interface ConversationDetail {
  id: string;
  store_id: string;
  channel_id: string | null;
  customer_id: string | null;
  channel_type: string | null;
  status: string;
  messages: ConversationMessage[];
  customer_name: string | null;
  customer_email: string | null;
  session_id: string | null;
  current_stage: string | null;
  // Sesión 2B — sistema de equipo
  agent_paused?: boolean;
  needs_seller_assignment?: boolean;
  assigned_user_id?: string | null;
  assigned_at?: string | null;
  handoff_summary?: string | null;  // JSON serializado del resumen del agente
}

export interface HandoffSummary {
  version?: string;
  generated_at?: string;
  priority?: "baja" | "media" | "alta" | "vip";
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
    reference?: string;
    observations?: string;
  };
  interest?: {
    products?: string[];
    categories?: string[];
    budget_range?: string;
    quantity?: number | null;
  };
  pricing?: {
    quoted_total?: string | number;
    discounts_applied?: any[];
    currency?: string;
  };
  objections?: string[];
  additional_info?: string;
  history?: {
    message_count?: number;
    stage_at_handoff?: string;
  };
}

export function parseHandoffSummary(raw: string | null | undefined): HandoffSummary | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HandoffSummary;
  } catch {
    return null;
  }
}

export interface ConversationFilters {
  needs_assignment?: boolean;
  assigned_to_me?: boolean;
}

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

export async function getConversations(
  storeId: string,
  filters?: ConversationFilters
): Promise<ConversationDetail[]> {
  const qs = new URLSearchParams();
  if (filters?.needs_assignment) qs.set("needs_assignment", "true");
  if (filters?.assigned_to_me) qs.set("assigned_to_me", "true");
  const query = qs.toString();
  return authFetch(`/conversations${query ? `?${query}` : ""}`, storeId);
}

export async function getConversation(storeId: string, id: string): Promise<ConversationDetail> {
  return authFetch(`/conversations/${id}`, storeId);
}

export async function getConversationMessages(storeId: string, id: string): Promise<ConversationMessage[]> {
  return authFetch(`/conversations/${id}/messages`, storeId);
}
