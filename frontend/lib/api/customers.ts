import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface Customer {
  id: string;
  store_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

export interface CreateCustomerPayload {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
}

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

export async function listCustomers(
  storeId: string,
  search?: string,
  limit = 50
): Promise<Customer[]> {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  qs.set("limit", String(limit));
  return authFetch(`/customers?${qs}`, storeId);
}

export async function createCustomer(
  storeId: string,
  payload: CreateCustomerPayload
): Promise<Customer> {
  return authFetch("/customers", storeId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCustomer(
  storeId: string,
  customerId: string,
  payload: CreateCustomerPayload
): Promise<Customer> {
  return authFetch(`/customers/${customerId}`, storeId, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
