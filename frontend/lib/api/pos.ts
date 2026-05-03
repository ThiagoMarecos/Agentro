import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// ─── Types ──────────────────────────────────────────

export interface CashRegister {
  id: string;
  store_id: string;
  user_id: string;
  opened_at: string;
  opening_cash: string;  // Decimal serializado
  closed_at: string | null;
  expected_cash: string | null;
  counted_cash: string | null;
  cash_difference: string | null;
  sales_count: number;
  sales_total: string;
  notes: string | null;
}

export interface POSSaleItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price?: number | string | null;
}

export interface POSSaleRequest {
  items: POSSaleItem[];
  customer_id?: string | null;
  payment_method_id?: string | null;
  payment_received?: number | string | null;
  payment_proof?: string | null;
  discount_amount?: number | string;
  shipping_amount?: number | string;
  notes?: string | null;
  from_conversation_id?: string | null;
}

export interface POSSaleResponse {
  order_id: string;
  order_number: string;
  subtotal: string;
  discount: string;
  shipping: string;
  total: string;
  payment_status: string;
  change_due: string | null;
  payment_redirect_url: string | null;
}

export interface RefundResponse {
  id: string;
  order_id: string;
  amount: string;
  reason: string | null;
  is_full_refund: boolean;
  created_at: string;
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

// ─── Cash Register ──────────────────────────────────

export async function getCurrentRegister(storeId: string): Promise<CashRegister | null> {
  return authFetch("/pos/cash-register/current", storeId);
}

export async function openRegister(
  storeId: string,
  openingCash: number
): Promise<CashRegister> {
  return authFetch("/pos/cash-register/open", storeId, {
    method: "POST",
    body: JSON.stringify({ opening_cash: openingCash }),
  });
}

export async function closeRegister(
  storeId: string,
  countedCash: number,
  notes?: string
): Promise<CashRegister> {
  return authFetch("/pos/cash-register/close", storeId, {
    method: "POST",
    body: JSON.stringify({ counted_cash: countedCash, notes: notes || null }),
  });
}

// ─── Sale ───────────────────────────────────────────

export async function createPOSSale(
  storeId: string,
  payload: POSSaleRequest
): Promise<POSSaleResponse> {
  return authFetch("/pos/sale", storeId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ─── Refund ─────────────────────────────────────────

export async function refundOrder(
  storeId: string,
  orderId: string,
  amount: number | null,
  reason?: string
): Promise<RefundResponse> {
  return authFetch(`/pos/orders/${orderId}/refund`, storeId, {
    method: "POST",
    body: JSON.stringify({ amount, reason: reason || null }),
  });
}
