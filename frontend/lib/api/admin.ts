/**
 * API client para Super Admin
 */

import { authFetch } from "@/lib/auth";

const API_URL = "/api/v1";

export interface DashboardData {
  total_stores: number;
  active_stores: number;
  suspended_stores: number;
  total_users: number;
  whatsapp_connected: number;
  recent_stores: Array<{
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
    owner_email: string | null;
  }>;
}

export interface StoreListItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
  owner_email: string | null;
  has_whatsapp: boolean;
}

export interface StoreListResponse {
  stores: StoreListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string | null;
  country: string | null;
  currency: string | null;
  is_active: boolean;
  created_at: string;
  owner_email: string | null;
  whatsapp_status: string | null;
  whatsapp_number: string | null;
  product_count: number;
  order_count: number;
  customer_count: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  resource_type: string | null;
  details: string | null;
  created_at: string;
  user_email: string | null;
}

export async function getAdminDashboard(): Promise<DashboardData> {
  const res = await authFetch(`${API_URL}/admin/dashboard`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener dashboard");
  }
  return res.json();
}

export async function getAdminStores(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
}): Promise<StoreListResponse> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.search) sp.set("search", params.search);
  if (params?.status) sp.set("status", params.status);

  const res = await authFetch(`${API_URL}/admin/stores?${sp.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener tiendas");
  }
  return res.json();
}

export async function getAdminStoreDetail(storeId: string): Promise<StoreDetail> {
  const res = await authFetch(`${API_URL}/admin/stores/${storeId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener detalle de tienda");
  }
  return res.json();
}

export async function updateStoreStatus(storeId: string, isActive: boolean): Promise<void> {
  const res = await authFetch(`${API_URL}/admin/stores/${storeId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar estado");
  }
}

export async function getStoreActivity(storeId: string, limit = 20): Promise<ActivityItem[]> {
  const res = await authFetch(`${API_URL}/admin/stores/${storeId}/activity?limit=${limit}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener actividad");
  }
  return res.json();
}

// ── Usuarios ──────────────────────────────────────────────────────

export interface UserListItem {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  auth_provider: string | null;
  created_at: string;
  last_login_at: string | null;
  store_count: number;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function getAdminUsers(params?: {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
}): Promise<UserListResponse> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.search) sp.set("search", params.search);
  if (params?.status) sp.set("status", params.status);

  const res = await authFetch(`${API_URL}/admin/users?${sp.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener usuarios");
  }
  return res.json();
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  const res = await authFetch(`${API_URL}/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar usuario");
  }
}

// ── Logs ──────────────────────────────────────────────────────────

export interface PlatformLogItem {
  id: string;
  action: string;
  resource_type: string | null;
  details: string | null;
  created_at: string;
  user_email: string | null;
  store_name: string | null;
}

export interface PlatformLogResponse {
  logs: PlatformLogItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function getAdminLogs(params?: {
  page?: number;
  page_size?: number;
  action_filter?: string;
}): Promise<PlatformLogResponse> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.action_filter) sp.set("action_filter", params.action_filter);

  const res = await authFetch(`${API_URL}/admin/logs?${sp.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener logs");
  }
  return res.json();
}

// ── System Health ─────────────────────────────────────────────────

export interface ServiceHealth {
  name: string;
  status: "ok" | "error" | "degraded";
  latency_ms: number | null;
  details: string | null;
  actions: string[] | null;
}

export interface VPSResources {
  cpu_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  memory_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_percent: number;
  uptime_seconds: number;
  load_avg_1m: number;
  load_avg_5m: number;
  load_avg_15m: number;
}

export interface HealthData {
  overall: "ok" | "error" | "degraded";
  services: ServiceHealth[];
  vps: VPSResources | null;
}

export async function getAdminHealth(): Promise<HealthData> {
  const res = await authFetch(`${API_URL}/admin/health`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al obtener estado del sistema");
  }
  return res.json();
}
