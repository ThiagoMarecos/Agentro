const API_URL = "/api/v1";

export async function getStore(slug: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}`);
  if (!res.ok) {
    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (data.detail === "STORE_SUSPENDED") throw new Error("STORE_SUSPENDED");
    }
    throw new Error("Tienda no encontrada");
  }
  return res.json();
}

export async function getProducts(slug: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}/products`);
  if (!res.ok) throw new Error("Error al obtener productos");
  return res.json();
}

export async function searchProducts(slug: string, query: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}/products?q=${encodeURIComponent(query)}&limit=8`);
  if (!res.ok) throw new Error("Error al buscar productos");
  return res.json();
}

export async function getProduct(slug: string, productId: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}/products/${productId}`);
  if (!res.ok) throw new Error("Producto no encontrado");
  return res.json();
}

export async function getDrops(slug: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}/drops`);
  if (!res.ok) throw new Error("Error al obtener drops");
  return res.json();
}

export async function getStorefrontPages(slug: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}/pages`);
  if (!res.ok) throw new Error("Error al obtener páginas");
  return res.json();
}

export async function getStorefrontPage(slug: string, pageSlug: string) {
  const res = await fetch(`${API_URL}/storefront/${slug}/pages/${pageSlug}`);
  if (!res.ok) throw new Error("Página no encontrada");
  return res.json();
}

export interface CreateOrderPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  notes: string;
  items: { product_id: string; variant_id?: string; quantity: number }[];
}

export async function createOrder(slug: string, payload: CreateOrderPayload) {
  const res = await fetch(`${API_URL}/storefront/${slug}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Error al crear el pedido");
  }
  return res.json();
}
