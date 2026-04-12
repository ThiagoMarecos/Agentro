const API_URL = "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("agentro_access_token");
}

export async function getStores() {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/stores`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al obtener tiendas");
  return res.json();
}

export async function getProducts(storeId: string) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/products?store_id=${storeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
    },
  });
  if (!res.ok) throw new Error("Error al obtener productos");
  return res.json();
}

export async function getOrders(storeId: string) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/orders?store_id=${storeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
    },
  });
  if (!res.ok) throw new Error("Error al obtener pedidos");
  return res.json();
}

export async function getOrder(storeId: string, orderId: string) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
    },
  });
  if (!res.ok) throw new Error("Error al obtener pedido");
  return res.json();
}

export async function updateOrderStatus(storeId: string, orderId: string, status: string) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Store-ID": storeId,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Error al actualizar estado");
  return res.json();
}

export interface CreateStoreData {
  name: string;
  slug: string;
  industry?: string;
  country?: string;
  currency?: string;
  language?: string;
  template_id?: string;
}

export async function createStore(data: CreateStoreData) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/stores`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear tienda");
  }
  return res.json();
}

export async function deleteStore(storeId: string) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/stores/${storeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al eliminar tienda");
  }
  return res.json();
}

export async function getCustomers(storeId: string) {
  const token = getToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(`${API_URL}/customers?store_id=${storeId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
    },
  });
  if (!res.ok) throw new Error("Error al obtener clientes");
  return res.json();
}
