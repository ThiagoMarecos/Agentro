import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface ProductListParams {
  search?: string;
  status?: string;
  category_id?: string;
  sort?: string;
  order?: string;
  skip?: number;
  limit?: number;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  supplier_id?: string | null;
  name: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  sku?: string | null;
  price: string;
  compare_at_price?: string | null;
  cost?: string | null;
  status: string;
  product_type: string;
  has_variants: boolean;
  is_featured: boolean;
  is_active: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  allow_backorder?: boolean;
  cover_image_url?: string | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
  category?: { id: string; name: string; slug: string } | null;
  supplier?: { id: string; name: string } | null;
  total_stock?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  origin_type?: string | null;
  lead_time_days?: number | null;
  internal_notes?: string | null;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string | null;
  price: string;
  compare_at_price?: string | null;
  stock_quantity: number;
  track_inventory: boolean;
  is_default: boolean;
  is_active: boolean;
  option_values?: Record<string, string> | null;
}

export interface ProductImage {
  id: string;
  url: string;
  alt_text?: string | null;
  sort_order: number;
  is_cover: boolean;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  price: string;
  status: string;
  stock_quantity: number;
  category_id?: string | null;
  category_name: string | null;
  cover_image_url: string | null;
  updated_at: string | null;
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
  skip: number;
  limit: number;
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

export async function uploadImage(storeId: string, file: File): Promise<{ url: string }> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al subir imagen");
  }
  return res.json();
}

export async function uploadVideo(storeId: string, file: File): Promise<{ url: string; type: string }> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Store-ID": storeId,
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al subir video");
  }
  return res.json();
}

export async function addProductImage(
  storeId: string,
  productId: string,
  data: { url: string; alt_text?: string; sort_order?: number; is_cover?: boolean }
): Promise<ProductImage> {
  const res = await fetch(`${API_URL}/products/${productId}/images`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al añadir imagen");
  }
  return res.json();
}

export async function deleteProductImage(
  storeId: string,
  productId: string,
  imageId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/products/${productId}/images/${imageId}`, {
    method: "DELETE",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al eliminar imagen");
}

export async function getProducts(
  storeId: string,
  params?: ProductListParams
): Promise<PaginatedProducts> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.category_id) searchParams.set("category_id", params.category_id);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.skip !== undefined) searchParams.set("skip", String(params.skip));
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));

  const url = `${API_URL}/products?${searchParams.toString()}`;
  const res = await fetch(url, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener productos");
  return res.json();
}

export async function getProduct(storeId: string, productId: string): Promise<Product> {
  const res = await fetch(`${API_URL}/products/${productId}`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener producto");
  return res.json();
}

export async function createProduct(
  storeId: string,
  data: Partial<Product> & { name: string; slug: string; price: number }
): Promise<Product> {
  const res = await fetch(`${API_URL}/products`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al crear producto");
  }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProduct(
  storeId: string,
  productId: string,
  data: Record<string, any>
): Promise<Product> {
  const res = await fetch(`${API_URL}/products/${productId}`, {
    method: "PATCH",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar producto");
  }
  return res.json();
}

export async function deleteProduct(storeId: string, productId: string): Promise<void> {
  const res = await fetch(`${API_URL}/products/${productId}`, {
    method: "DELETE",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al eliminar producto");
}

export interface BulkDeleteResult {
  success: boolean;
  deleted_count: number;
  errors: string[];
}

export async function bulkDeleteProducts(
  storeId: string,
  productIds: string[]
): Promise<BulkDeleteResult> {
  const res = await fetch(`${API_URL}/products/bulk-delete`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify({ product_ids: productIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al eliminar productos");
  }
  return res.json();
}

export interface AIPrefillResult {
  name: string;
  slug: string;
  short_description: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  sku: string;
  category_id: string | null;
  seo_title: string;
  seo_description: string;
  images: { url: string; alt: string; is_cover: boolean; sort_order: number }[];
}

export async function aiPrefillProduct(
  storeId: string,
  description: string
): Promise<AIPrefillResult> {
  const res = await fetch(`${API_URL}/products/ai-prefill`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al generar producto con IA");
  }
  return res.json();
}

export interface BulkImportProduct {
  name: string;
  description?: string;
  price?: number | string;
  compare_at_price?: number | string;
  sku?: string;
  image_urls?: string[];
  stock_quantity?: number | null;
}

export interface BulkImportResult {
  success: boolean;
  products_imported: number;
  images_downloaded: number;
}

export async function bulkImportProducts(
  storeId: string,
  products: BulkImportProduct[]
): Promise<BulkImportResult> {
  const controller = new AbortController();
  // 5 minutes timeout — downloading images for many products takes time
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  try {
    const res = await fetch(`${API_URL}/products/bulk-import`, {
      method: "POST",
      headers: authHeaders(storeId),
      body: JSON.stringify({ products }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error al importar productos");
    }
    return res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        "La importación tardó demasiado. Intentá con menos productos o productos con menos imágenes."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function duplicateProduct(
  storeId: string,
  productId: string,
  newSlug: string
): Promise<Product> {
  const res = await fetch(
    `${API_URL}/products/${productId}/duplicate?new_slug=${encodeURIComponent(newSlug)}`,
    {
      method: "POST",
      headers: authHeaders(storeId),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al duplicar producto");
  }
  return res.json();
}
