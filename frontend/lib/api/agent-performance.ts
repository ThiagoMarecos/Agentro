import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

/* ── Types ───────────────────────────────────────── */

export interface OverviewStats {
  days: number;
  total_conversations: number;
  completed_sales: number;
  escalated: number;
  dropped: number;
  ongoing: number;
  total_messages: number;
  total_tokens: number;
  estimated_cost_usd: number;
  success_rate: number;
  total_sales_value: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percent_of_total: number;
  dropoff_from_previous_pct: number;
}

export interface OutcomeRow {
  outcome: string;
  count: number;
}

export interface ResponseTimeStats {
  count: number;
  avg_seconds: number;
  median_seconds: number;
}

export interface ZeroResultRow {
  query_excerpt: string;
  occurrences: number;
}

export interface RecentConversation {
  id: string;
  created_at: string | null;
  outcome: string;
  outcome_reason: string | null;
  last_stage_reached: string | null;
  tool_calls_count: number;
  total_tokens: number;
  estimated_value: number | null;
}

export interface DashboardPayload {
  overview: OverviewStats;
  funnel: FunnelStage[];
  dropoff: FunnelStage[];
  outcomes: OutcomeRow[];
  response_time: ResponseTimeStats;
  zero_result_searches: ZeroResultRow[];
}

/* ── Fetch helper ───────────────────────────────── */

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
  return res.json();
}

/* ── Endpoints ──────────────────────────────────── */

export async function getDashboard(storeId: string, days = 30): Promise<DashboardPayload> {
  return authFetch(`/agent-performance/dashboard?days=${days}`, storeId);
}

export async function getOverview(storeId: string, days = 30): Promise<OverviewStats> {
  return authFetch(`/agent-performance/overview?days=${days}`, storeId);
}

export async function getFunnel(storeId: string, days = 30): Promise<FunnelStage[]> {
  return authFetch(`/agent-performance/funnel?days=${days}`, storeId);
}

export async function getDropoff(storeId: string, days = 30): Promise<FunnelStage[]> {
  return authFetch(`/agent-performance/dropoff?days=${days}`, storeId);
}

export async function getOutcomes(storeId: string, days = 30): Promise<OutcomeRow[]> {
  return authFetch(`/agent-performance/outcomes?days=${days}`, storeId);
}

export async function getResponseTime(storeId: string, days = 30): Promise<ResponseTimeStats> {
  return authFetch(`/agent-performance/response-time?days=${days}`, storeId);
}

export async function getZeroResults(storeId: string, days = 30, limit = 20): Promise<ZeroResultRow[]> {
  return authFetch(`/agent-performance/zero-results?days=${days}&limit=${limit}`, storeId);
}

export async function getRecentConversations(
  storeId: string,
  opts: { limit?: number; outcome?: string; stage?: string } = {}
): Promise<RecentConversation[]> {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.outcome) qs.set("outcome", opts.outcome);
  if (opts.stage) qs.set("stage", opts.stage);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/agent-performance/conversations${suffix}`, storeId);
}
