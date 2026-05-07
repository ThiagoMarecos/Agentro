import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface SimStore {
  id: string;
  name: string;
  slug: string;
}

export interface SimMessage {
  id: string;
  role: string;
  content: string;
  created_at: string | null;
}

export interface SimConversationData {
  conversation_id: string | null;
  customer_id: string | null;
  stage: string | null;
  messages: SimMessage[];
}

export interface SimSendResponse {
  response: string | null;
  pending_media: Array<{ type: string; url: string; b64?: string | null; caption?: string }>;
  conversation_id: string;
  session_id: string;
  stage: string;
  agent_paused: boolean;
}

export interface SimResetResponse {
  deleted_messages: number;
  deleted_sessions: number;
  deleted_conversations: number;
  deleted_customers: number;
}

export interface GlobalLearningStatus {
  enabled: boolean;
  affected_agents: number;
  affected_stores: number;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ── Simulador ──────────────────────────────────────

export async function listSimulatorStores(): Promise<SimStore[]> {
  return authFetch("/admin/simulator/stores");
}

export async function getSimulatorConversation(
  storeId: string,
  customerIdentifier: string
): Promise<SimConversationData> {
  const qs = new URLSearchParams({ store_id: storeId, customer_identifier: customerIdentifier });
  return authFetch(`/admin/simulator/conversation?${qs}`);
}

export async function sendSimulatorMessage(
  storeId: string,
  customerIdentifier: string,
  message: string
): Promise<SimSendResponse> {
  return authFetch("/admin/simulator/send", {
    method: "POST",
    body: JSON.stringify({
      store_id: storeId,
      customer_identifier: customerIdentifier,
      message,
    }),
  });
}

export async function resetSimulator(
  storeId: string,
  customerIdentifier: string,
  deleteCustomer = true
): Promise<SimResetResponse> {
  return authFetch("/admin/simulator/reset", {
    method: "POST",
    body: JSON.stringify({
      store_id: storeId,
      customer_identifier: customerIdentifier,
      delete_customer: deleteCustomer,
    }),
  });
}

// ── Learning mode global ──────────────────────────

export async function getGlobalLearningMode(): Promise<GlobalLearningStatus> {
  return authFetch("/admin/simulator/learning-mode/status");
}

export async function setGlobalLearningMode(enabled: boolean): Promise<GlobalLearningStatus> {
  return authFetch("/admin/simulator/learning-mode/global", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}
