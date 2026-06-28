import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// ─── Types ───────────────────────────────────────────────

export type FlowNodeType =
  | "trigger"
  | "branch_response"
  | "condition"
  | "message"
  | "tool_call"
  | "escalate"
  | "collect_data"
  | "delay"
  | "stage";

export interface FlowNode {
  id: string;
  type: FlowNodeType | string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  data?: Record<string, any>;
}

export interface AgentFlow {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  is_active: boolean;
  version: number;
  parent_flow_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Auth helper ────────────────────────────────────────

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
    const detail = typeof err.detail === "string" ? err.detail : err.detail?.message;
    throw new Error(detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── API calls ──────────────────────────────────────────

export async function listFlows(storeId: string): Promise<AgentFlow[]> {
  return authFetch("/agent-flows", storeId);
}

export async function getFlow(storeId: string, flowId: string): Promise<AgentFlow> {
  return authFetch(`/agent-flows/${flowId}`, storeId);
}

export async function createFlow(
  storeId: string,
  payload: { name: string; description?: string | null; nodes?: FlowNode[]; edges?: FlowEdge[] },
): Promise<AgentFlow> {
  return authFetch("/agent-flows", storeId, {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      description: payload.description ?? null,
      nodes: payload.nodes ?? [],
      edges: payload.edges ?? [],
    }),
  });
}

export async function updateFlow(
  storeId: string,
  flowId: string,
  payload: { name?: string; description?: string | null; nodes?: FlowNode[]; edges?: FlowEdge[] },
): Promise<AgentFlow> {
  return authFetch(`/agent-flows/${flowId}`, storeId, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function activateFlow(storeId: string, flowId: string): Promise<AgentFlow> {
  return authFetch(`/agent-flows/${flowId}/activate`, storeId, { method: "POST" });
}

/** Genera un flow con IA a partir de una descripción del negocio. */
export async function generateFlow(
  storeId: string,
  prompt: string,
  name?: string,
): Promise<AgentFlow> {
  return authFetch("/agent-flows/generate", storeId, {
    method: "POST",
    body: JSON.stringify({ prompt, name: name ?? null }),
  });
}

export async function deleteFlow(storeId: string, flowId: string): Promise<void> {
  await authFetch(`/agent-flows/${flowId}`, storeId, { method: "DELETE" });
}
