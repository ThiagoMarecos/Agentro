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

export async function getConversations(storeId: string): Promise<ConversationDetail[]> {
  return authFetch("/conversations", storeId);
}

export async function getConversation(storeId: string, id: string): Promise<ConversationDetail> {
  return authFetch(`/conversations/${id}`, storeId);
}

export async function getConversationMessages(storeId: string, id: string): Promise<ConversationMessage[]> {
  return authFetch(`/conversations/${id}/messages`, storeId);
}
