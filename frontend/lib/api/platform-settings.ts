/**
 * API client para configuración de plataforma (solo superadmin)
 */

import { authFetch } from "@/lib/auth";

const API_URL = "/api/v1";

export interface PlatformSetting {
  id: string;
  key: string;
  label: string;
  category: string;
  is_secret: boolean;
  has_value: boolean;
  display_value: string;
  real_value: string;
}

export async function getPlatformSettings(): Promise<PlatformSetting[]> {
  const res = await authFetch(`${API_URL}/admin/platform-settings`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener configuración");
  }
  return res.json();
}

export async function updatePlatformSettings(
  settings: Record<string, string>
): Promise<{ ok: boolean; updated: number; message: string }> {
  const res = await authFetch(`${API_URL}/admin/platform-settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar configuración");
  }
  return res.json();
}
