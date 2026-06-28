import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// ─── Types ───────────────────────────────────────────────

export type DiscountType = "percent" | "amount";
export type DiscountDuration = "once" | "repeating" | "forever";
export type DiscountStatus = "active" | "canceled" | "expired";

export interface Discount {
  id: string;
  store_id: string;
  store_name: string | null;
  store_slug: string | null;
  applied_by_user_id: string | null;
  applied_by_email: string | null;
  stripe_coupon_id: string;
  stripe_discount_id: string | null;
  discount_type: DiscountType;
  discount_value: number; // percent 1-100 o cents si amount
  duration: DiscountDuration;
  duration_in_months: number | null;
  reason: string;
  status: DiscountStatus;
  expires_at: string | null;
  canceled_at: string | null;
  created_at: string;
}

export interface ApplyDiscountPayload {
  store_id: string;
  discount_type: DiscountType;
  discount_value: number;
  duration: DiscountDuration;
  duration_in_months?: number | null;
  reason: string;
}

// ─── Auth helper ───────────────────────────────────────

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : err.detail?.message;
    throw new Error(detail || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── API calls ─────────────────────────────────────────

export async function listDiscounts(filters?: {
  status?: DiscountStatus;
  store_id?: string;
}): Promise<Discount[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.store_id) params.set("store_id", filters.store_id);
  const qs = params.toString();
  return adminFetch(`/admin/discounts${qs ? `?${qs}` : ""}`);
}

export async function applyDiscount(payload: ApplyDiscountPayload): Promise<Discount> {
  return adminFetch("/admin/discounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelDiscount(discountId: string): Promise<Discount> {
  return adminFetch(`/admin/discounts/${discountId}`, { method: "DELETE" });
}

// ─── Display helpers ───────────────────────────────────

export function formatDiscount(d: Discount): string {
  const valueStr =
    d.discount_type === "percent"
      ? `${d.discount_value}% off`
      : `$${(d.discount_value / 100).toFixed(2)} off`;

  const durationStr =
    d.duration === "once"
      ? "una vez"
      : d.duration === "forever"
      ? "para siempre"
      : `por ${d.duration_in_months} mes${d.duration_in_months === 1 ? "" : "es"}`;

  return `${valueStr} (${durationStr})`;
}
