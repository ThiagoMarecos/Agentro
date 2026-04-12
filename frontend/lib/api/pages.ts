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

export interface PageBlock {
  type: "text" | "image" | "video" | "products" | "cta";
  config: Record<string, any>;
}

export interface StorePage {
  id: string;
  title: string;
  slug: string;
  blocks: PageBlock[];
  is_published: boolean;
  sort_order: number;
  created_at?: string;
}

export async function listPages(storeId: string): Promise<StorePage[]> {
  const res = await fetch(`${API_URL}/pages`, { headers: authHeaders(storeId) });
  if (!res.ok) throw new Error("Error al obtener páginas");
  return res.json();
}

export async function createPage(
  storeId: string,
  data: { title: string; slug: string; blocks?: PageBlock[]; is_published?: boolean },
): Promise<StorePage> {
  const res = await fetch(`${API_URL}/pages`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al crear página");
  return res.json();
}

export async function updatePage(
  storeId: string,
  pageId: string,
  data: Partial<StorePage>,
): Promise<StorePage> {
  const res = await fetch(`${API_URL}/pages/${pageId}`, {
    method: "PATCH",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al actualizar página");
  return res.json();
}

export async function deletePage(storeId: string, pageId: string): Promise<void> {
  const res = await fetch(`${API_URL}/pages/${pageId}`, {
    method: "DELETE",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al eliminar página");
}
