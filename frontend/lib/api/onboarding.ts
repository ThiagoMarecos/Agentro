import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface OnboardingStatus {
  authenticated: boolean;
  has_store: boolean;
  current_store?: { id: string; name: string; slug: string } | null;
  must_onboard: boolean;
  suggested_redirect: string;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");

  const res = await fetch(`${API_URL}/onboarding/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al obtener estado");
  return res.json();
}

export interface CreateStoreData {
  name: string;
  slug: string;
  industry?: string;
  country?: string;
  currency?: string;
  language?: string;
  template_id?: string;
}

export interface CreateStoreResponse {
  store: { id: string; name: string; slug: string };
  membership: Record<string, string>;
  theme: Record<string, string>;
  next_redirect: string;
}

export async function createStore(data: CreateStoreData): Promise<CreateStoreResponse> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");

  const res = await fetch(`${API_URL}/onboarding/store`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear tienda");
  }
  return res.json();
}
