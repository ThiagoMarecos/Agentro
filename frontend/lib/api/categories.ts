import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface Category {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order: number;
  is_active: boolean;
}

function authHeaders(storeId: string) {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Store-ID": storeId,
  };
}

export async function getCategories(storeId: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener categorías");
  return res.json();
}

export async function getCategory(storeId: string, categoryId: string): Promise<Category> {
  const res = await fetch(`${API_URL}/categories/${categoryId}`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener categoría");
  return res.json();
}

export async function createCategory(
  storeId: string,
  data: { name: string; slug: string; description?: string; parent_id?: string; sort_order?: number; is_active?: boolean }
): Promise<Category> {
  const res = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear categoría");
  }
  return res.json();
}

export async function updateCategory(
  storeId: string,
  categoryId: string,
  data: Partial<Category>
): Promise<Category> {
  const res = await fetch(`${API_URL}/categories/${categoryId}`, {
    method: "PATCH",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar categoría");
  }
  return res.json();
}

export async function deleteCategory(storeId: string, categoryId: string): Promise<void> {
  const res = await fetch(`${API_URL}/categories/${categoryId}`, {
    method: "DELETE",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al eliminar categoría");
}
