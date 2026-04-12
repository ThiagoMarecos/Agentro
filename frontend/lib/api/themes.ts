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

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  surface?: string;
  border?: string;
  success?: string;
  error?: string;
  warning?: string;
}

export interface ThemeTypography {
  font_family: string;
  heading_scale: string;
  heading_font?: string;
  heading_weight?: string;
  body_size?: string;
}

export interface ThemeConfig {
  colors: ThemeColors;
  typography: ThemeTypography;
  button_style: string;
  card_style: string;
  hero_style: string;
  layout_density: string;
  custom_banner?: string;
  custom_css?: string;
  color_mode?: string;
  section_toggles?: Record<string, boolean>;
  sections?: any[];
}

export interface StoreTheme {
  id?: string;
  template_name: string;
  custom_css?: string | null;
  custom_config: ThemeConfig;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  default_tokens: ThemeConfig;
}

export async function getThemePresets(): Promise<ThemePreset[]> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/themes/presets`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Error al obtener presets");
  return res.json();
}

export async function getStoreTheme(storeId: string): Promise<StoreTheme> {
  const res = await fetch(`${API_URL}/themes/current`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener tema");
  return res.json();
}

export async function updateStoreTheme(
  storeId: string,
  data: { template_name?: string; custom_config?: Partial<ThemeConfig> }
): Promise<StoreTheme> {
  const res = await fetch(`${API_URL}/themes/current`, {
    method: "PATCH",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar tema");
  }
  return res.json();
}

export async function applyThemePreset(
  storeId: string,
  presetId: string
): Promise<StoreTheme> {
  const res = await fetch(`${API_URL}/themes/current/apply-preset/${presetId}`, {
    method: "POST",
    headers: authHeaders(storeId),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al aplicar preset");
  }
  return res.json();
}

export interface ThemeVersionItem {
  id: string;
  version: number;
  template_name: string;
  created_at: string;
}

export async function getThemeVersions(storeId: string): Promise<ThemeVersionItem[]> {
  const res = await fetch(`${API_URL}/themes/versions`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener versiones");
  return res.json();
}

export async function restoreThemeVersion(storeId: string, versionId: string): Promise<StoreTheme> {
  const res = await fetch(`${API_URL}/themes/versions/${versionId}/restore`, {
    method: "POST",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al restaurar versión");
  return res.json();
}

export interface MarketplaceTemplate {
  id: string;
  name: string;
  author: string;
  description: string;
  preview_image?: string;
  downloads: number;
  is_featured: boolean;
}

export async function getMarketplaceTemplates(): Promise<MarketplaceTemplate[]> {
  const token = getStoredToken();
  const res = await fetch(`${API_URL}/themes/marketplace`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Error al obtener plantillas");
  return res.json();
}

export async function installMarketplaceTemplate(storeId: string, templateId: string): Promise<StoreTheme> {
  const res = await fetch(`${API_URL}/themes/marketplace/${templateId}/install`, {
    method: "POST",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al instalar plantilla");
  return res.json();
}
