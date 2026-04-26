import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// ─── Types ───────────────────────────────────────────────

export type Role = "owner" | "admin" | "manager" | "support" | "seller";
export type AssignableRole = "manager" | "seller" | "support";

export interface TeamMember {
  id: string;          // store_member id
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  joined_at: string;
}

export interface Invitation {
  id: string;
  store_id: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  invited_by_name: string | null;
  accept_url: string | null;
}

export interface InvitationInfo {
  email: string;
  role: Role;
  store_name: string;
  inviter_name: string | null;
  expires_at: string | null;
  user_exists: boolean;
}

export interface AcceptInvitationResponse {
  success: boolean;
  store_id: string;
  store_name: string;
  role: Role;
  user_id: string;
  requires_login: boolean;
}

export interface AssignedConversation {
  conversation_id: string;
  assigned_user_id: string | null;
  assigned_at: string | null;
  needs_seller_assignment: boolean;
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
  if (res.status === 204) return null;
  return res.json();
}

// Endpoints públicos del flujo de invitación (sin auth, sin store header)
async function publicFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  Object.assign(headers, (options.headers as Record<string, string>) || {});

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ─── Members ────────────────────────────────────────────

export async function listTeamMembers(storeId: string): Promise<TeamMember[]> {
  return authFetch("/team/members", storeId);
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  role: AssignableRole
): Promise<TeamMember> {
  return authFetch(`/team/members/${memberId}`, storeId, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(storeId: string, memberId: string): Promise<void> {
  return authFetch(`/team/members/${memberId}`, storeId, { method: "DELETE" });
}

// ─── Invitations ────────────────────────────────────────

export async function listInvitations(storeId: string): Promise<Invitation[]> {
  return authFetch("/team/invitations", storeId);
}

export async function createInvitation(
  storeId: string,
  email: string,
  role: AssignableRole
): Promise<Invitation> {
  return authFetch("/team/invitations", storeId, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function revokeInvitation(storeId: string, invitationId: string): Promise<void> {
  return authFetch(`/team/invitations/${invitationId}`, storeId, { method: "DELETE" });
}

// ─── Public invitation flow ─────────────────────────────

export async function getInvitationInfo(token: string): Promise<InvitationInfo> {
  return publicFetch(`/team/invite/${token}/info`);
}

export async function acceptInvitation(
  token: string,
  payload: { full_name?: string; password?: string }
): Promise<AcceptInvitationResponse> {
  return publicFetch(`/team/invite/${token}/accept`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Conversation assignment ────────────────────────────

export async function assignConversation(
  storeId: string,
  conversationId: string,
  userId: string | null
): Promise<AssignedConversation> {
  return authFetch(`/conversations/${conversationId}/assign`, storeId, {
    method: "PATCH",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function takeControl(
  storeId: string,
  conversationId: string
): Promise<{ conversation_id: string; agent_paused: boolean }> {
  return authFetch(`/conversations/${conversationId}/take-control`, storeId, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function releaseToAgent(
  storeId: string,
  conversationId: string
): Promise<{ conversation_id: string; agent_paused: boolean }> {
  return authFetch(`/conversations/${conversationId}/release`, storeId, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
