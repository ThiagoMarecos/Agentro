import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

function authHeaders(storeId: string) {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Store-ID": storeId,
  };
}

export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  business_type: string | null;
  country: string | null;
  currency: string;
  language: string;
  timezone: string | null;
  template_id: string | null;
  is_active: boolean;
  support_email: string | null;
  support_phone: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

export interface StoreSettingsUpdate {
  name?: string;
  slug?: string;
  description?: string;
  industry?: string;
  business_type?: string;
  country?: string;
  currency?: string;
  language?: string;
  timezone?: string;
  support_email?: string;
  support_phone?: string;
  logo_url?: string;
  favicon_url?: string;
  og_image_url?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
}

export async function getStoreSettings(
  storeId: string
): Promise<StoreSettings> {
  const res = await fetch(`${API_URL}/stores/current/settings`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener configuración");
  return res.json();
}

export async function updateStoreSettings(
  storeId: string,
  data: StoreSettingsUpdate
): Promise<StoreSettings> {
  const res = await fetch(`${API_URL}/stores/current/settings`, {
    method: "PATCH",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar configuración");
  }
  return res.json();
}
