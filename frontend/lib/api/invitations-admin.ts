/**
 * API client del super admin para gestionar invitation_requests.
 * Requiere user.is_superadmin = true.
 */

import { authFetch } from "@/lib/auth";

const API_URL = "/api/v1";

export type InvitationStatus = "pending" | "approved" | "rejected" | "contacted";

export interface InvitationRequestAdminItem {
  id: string;
  email: string;
  full_name: string;
  business_name: string;
  business_type: string;
  whatsapp?: string | null;
  country?: string | null;
  referral_source?: string | null;
  referral_detail?: string | null;
  expectations?: string | null;
  accepts_contact: boolean;
  status: InvitationStatus;
  notes?: string | null;
  created_at: string;
  approved_at?: string | null;
}

export async function listInvitationRequests(params?: {
  status?: InvitationStatus | "all";
  limit?: number;
}): Promise<InvitationRequestAdminItem[]> {
  const q = new URLSearchParams();
  if (params?.status && params.status !== "all") q.set("status_filter", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  const res = await authFetch(
    `${API_URL}/admin/invitation-requests${qs ? `?${qs}` : ""}`
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt || "no se pudieron cargar las invitaciones"}`);
  }
  return (await res.json()) as InvitationRequestAdminItem[];
}

export async function updateInvitationRequest(
  id: string,
  payload: { status?: InvitationStatus; notes?: string }
): Promise<InvitationRequestAdminItem> {
  const res = await authFetch(`${API_URL}/admin/invitation-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Error ${res.status}: ${txt || "no se pudo actualizar"}`);
  }
  return (await res.json()) as InvitationRequestAdminItem;
}
