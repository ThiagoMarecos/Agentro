import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// ─── Types ──────────────────────────────────────────

export type ProviderKind = "cash" | "manual_external" | "manual_transfer" | "digital_redirect";

export interface ProviderConfigField {
  key: string;
  label: string;
  type: "text" | "secret";
  required: boolean;
}

export interface ProviderInfo {
  key: string;
  name: string;
  countries: string[];
  kind: ProviderKind;
  config_fields: ProviderConfigField[];
  icon: string;
  description: string;
}

export interface PaymentMethod {
  id: string;
  store_id: string;
  provider: string;
  display_name: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, any>;
  created_at: string;
}

export interface RecommendationResponse {
  country_code: string | null;
  recommended_keys: string[];
  providers: ProviderInfo[];
}

// ─── Auth helper ────────────────────────────────────

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

// ─── Providers (catalogo) ───────────────────────────

export async function listProviders(storeId: string, country?: string): Promise<ProviderInfo[]> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  return authFetch(`/payment-providers${qs}`, storeId);
}

export async function getRecommendedProviders(storeId: string): Promise<RecommendationResponse> {
  return authFetch(`/payment-providers/recommended`, storeId);
}

// ─── Payment Methods (CRUD por tienda) ──────────────

export async function listPaymentMethods(storeId: string): Promise<PaymentMethod[]> {
  return authFetch("/payment-methods", storeId);
}

export async function createPaymentMethod(
  storeId: string,
  payload: {
    provider: string;
    display_name?: string;
    is_active?: boolean;
    sort_order?: number;
    config?: Record<string, any>;
  }
): Promise<PaymentMethod> {
  return authFetch("/payment-methods", storeId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePaymentMethod(
  storeId: string,
  methodId: string,
  payload: {
    display_name?: string | null;
    is_active?: boolean;
    sort_order?: number;
    config?: Record<string, any>;
  }
): Promise<PaymentMethod> {
  return authFetch(`/payment-methods/${methodId}`, storeId, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePaymentMethod(storeId: string, methodId: string): Promise<void> {
  return authFetch(`/payment-methods/${methodId}`, storeId, { method: "DELETE" });
}
