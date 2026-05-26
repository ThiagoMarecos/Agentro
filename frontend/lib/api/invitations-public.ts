// Cliente del endpoint público de pedir invitación.
// No requiere auth — cualquier visitante de la landing lo puede llamar.

const API_URL = "/api/v1";

export type BusinessType = "retail" | "gastro" | "services" | "ecommerce" | "other";
export type ReferralSource =
  | "google"
  | "ai"
  | "recommendation"
  | "social"
  | "ad"
  | "press"
  | "event"
  | "other";

export interface InvitationRequestPayload {
  email: string;
  full_name: string;
  business_name: string;
  business_type: BusinessType;
  whatsapp?: string;
  country?: string;
  referral_source?: ReferralSource;
  referral_detail?: string;
  expectations?: string;
  accepts_contact?: boolean;
}

export interface InvitationRequestResponse {
  received: boolean;
  message: string;
  request_id: string;
}

export async function createInvitationRequest(
  payload: InvitationRequestPayload
): Promise<InvitationRequestResponse> {
  const res = await fetch(`${API_URL}/invitation-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Error ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as InvitationRequestResponse;
}
