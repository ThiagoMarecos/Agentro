import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface AIAgent {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  is_active: boolean;
  agent_type?: string;
  stage_name?: string | null;
  display_name?: string | null;
  tone?: string | null;
  language?: string | null;
  sales_style?: string | null;
  enabled_tools?: string | null;
  config?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AIAgentCreate {
  name: string;
  description?: string;
  system_prompt?: string;
  config?: string;
  is_active?: boolean;
  agent_type?: string;
  stage_name?: string;
  display_name?: string;
  tone?: string;
  language?: string;
  sales_style?: string;
  enabled_tools?: string;
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

export async function getAgents(storeId: string): Promise<AIAgent[]> {
  return authFetch("/ai-agents", storeId);
}

export async function createAgent(storeId: string, data: AIAgentCreate): Promise<AIAgent> {
  return authFetch("/ai-agents", storeId, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(storeId: string, agentId: string): Promise<void> {
  await authFetch(`/ai-agents/${agentId}`, storeId, { method: "DELETE" });
}

export async function updateAgent(storeId: string, agentId: string, data: Partial<AIAgentCreate>): Promise<AIAgent> {
  return authFetch(`/ai-agents/${agentId}`, storeId, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getStageAgents(storeId: string): Promise<AIAgent[]> {
  return authFetch("/ai-agents/stage-agents/list", storeId);
}

export async function seedStageAgents(storeId: string): Promise<AIAgent[]> {
  return authFetch("/ai-agents/seed-stage-agents", storeId, { method: "POST" });
}

export async function deleteAllStageAgents(storeId: string): Promise<{ success: boolean; deleted: number }> {
  return authFetch("/ai-agents/bulk/stage-agents", storeId, { method: "DELETE" });
}

export async function deleteAllAgents(storeId: string): Promise<{ success: boolean; deleted: number }> {
  return authFetch("/ai-agents/bulk/all", storeId, { method: "DELETE" });
}

export async function toggleAllAgents(storeId: string): Promise<{ success: boolean; is_active: boolean; count: number }> {
  return authFetch("/ai-agents/bulk/toggle-all", storeId, { method: "PATCH" });
}
