import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface NotebookSection {
  customer: Record<string, any>;
  intent: Record<string, any>;
  interest: Record<string, any>;
  recommendation: Record<string, any>;
  pricing: Record<string, any>;
  availability: Record<string, any>;
  shipping: Record<string, any>;
  payment: Record<string, any>;
  order: Record<string, any>;
  agent_control: Record<string, any>;
}

export interface SalesSessionListItem {
  id: string;
  current_stage: string;
  status: string;
  estimated_value: number | null;
  currency: string;
  priority: string;
  customer_email: string | null;
  customer_name: string | null;
  last_agent_action: string | null;
  follow_up_count: number;
  started_at: string | null;
  stage_entered_at: string | null;
}

export interface SalesSessionDetail {
  id: string;
  store_id: string;
  agent_id: string | null;
  conversation_id: string;
  customer_id: string | null;
  channel_id: string | null;
  current_stage: string;
  status: string;
  estimated_value: number | null;
  currency: string;
  priority: string;
  blocker_reason: string | null;
  last_agent_action: string | null;
  next_expected_action: string | null;
  follow_up_count: number;
  owner_notified: boolean;
  requires_manual_review: boolean;
  started_at: string | null;
  stage_entered_at: string | null;
  closed_at: string | null;
  notebook: NotebookSection | null;
}

export interface PipelineStage {
  stage: string;
  count: number;
  sessions: SalesSessionListItem[];
}

export interface PipelineResponse {
  stages: PipelineStage[];
  total: number;
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

export async function getSalesSessions(storeId: string): Promise<SalesSessionListItem[]> {
  return authFetch("/sales-sessions", storeId);
}

export async function getSalesPipeline(storeId: string): Promise<PipelineResponse> {
  return authFetch("/sales-sessions/pipeline", storeId);
}

export async function getSalesSession(storeId: string, id: string): Promise<SalesSessionDetail> {
  return authFetch(`/sales-sessions/${id}`, storeId);
}

export async function updateSalesSession(
  storeId: string,
  id: string,
  data: { priority?: string; requires_manual_review?: boolean; owner_notified?: boolean; blocker_reason?: string }
): Promise<SalesSessionDetail> {
  return authFetch(`/sales-sessions/${id}`, storeId, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
