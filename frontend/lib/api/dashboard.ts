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

export interface SetupCheck {
  id: string;
  label: string;
  completed: boolean;
}

export interface SetupProgress {
  checks: SetupCheck[];
  completed: number;
  total: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
}

export interface DashboardSummary {
  total_products: number;
  active_products: number;
  draft_products: number;
  archived_products: number;
  total_categories: number;
  low_stock_count: number;
  conversations_count: number;
  ai_agents_count: number;
  store_created_at: string | null;
  setup_progress: SetupProgress;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  revenue_prev_month: number;
  revenue_all_time: number;
  month_change_pct: number | null;
  orders_today: number;
  orders_week: number;
  orders_month: number;
  total_orders: number;
  pending_orders: number;
  avg_order_value: number;
  daily_revenue: DailyRevenue[];
}

export interface ActivityItem {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
  user_email: string | null;
}

export async function getDashboardSummary(
  storeId: string
): Promise<DashboardSummary> {
  const res = await fetch(`${API_URL}/dashboard/summary`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener resumen del dashboard");
  return res.json();
}

export async function getDashboardActivity(
  storeId: string,
  limit = 20
): Promise<ActivityItem[]> {
  const res = await fetch(
    `${API_URL}/dashboard/activity?limit=${limit}`,
    { headers: authHeaders(storeId) }
  );
  if (!res.ok) throw new Error("Error al obtener actividad");
  return res.json();
}
