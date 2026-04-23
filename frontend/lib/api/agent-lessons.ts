import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

/* ── Types ───────────────────────────────────────── */

export interface AgentLesson {
  id: string;
  agent_id: string;
  store_id: string;
  title: string;
  lesson_text: string;
  bad_response_example: string | null;
  correct_response: string | null;
  category: string | null;
  is_active: boolean;
  priority: number | null;
  source_conversation_id: string | null;
  created_at: string | null;
}

export interface AgentLessonCreate {
  agent_id: string;
  title: string;
  lesson_text: string;
  bad_response_example?: string;
  correct_response?: string;
  category?: string;
  is_active?: boolean;
  priority?: number;
  source_conversation_id?: string;
}

export interface AgentLessonUpdate {
  title?: string;
  lesson_text?: string;
  bad_response_example?: string;
  correct_response?: string;
  category?: string;
  is_active?: boolean;
  priority?: number;
}

/* ── Fetch helper ───────────────────────────────── */

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

/* ── Endpoints ──────────────────────────────────── */

export async function listLessons(
  storeId: string,
  opts: { agentId?: string; onlyActive?: boolean } = {}
): Promise<AgentLesson[]> {
  const qs = new URLSearchParams();
  if (opts.agentId) qs.set("agent_id", opts.agentId);
  if (opts.onlyActive) qs.set("only_active", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/agent-lessons${suffix}`, storeId);
}

export async function createLesson(storeId: string, data: AgentLessonCreate): Promise<AgentLesson> {
  return authFetch("/agent-lessons", storeId, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateLesson(
  storeId: string,
  lessonId: string,
  data: AgentLessonUpdate
): Promise<AgentLesson> {
  return authFetch(`/agent-lessons/${lessonId}`, storeId, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteLesson(storeId: string, lessonId: string): Promise<void> {
  await authFetch(`/agent-lessons/${lessonId}`, storeId, { method: "DELETE" });
}

export async function toggleLearningMode(
  storeId: string,
  agentId: string
): Promise<{ success: boolean; learning_mode_enabled: boolean }> {
  return authFetch(`/agent-lessons/agent/${agentId}/toggle-learning-mode`, storeId, {
    method: "POST",
  });
}
