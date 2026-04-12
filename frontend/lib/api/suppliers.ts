import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface Supplier {
  id: string;
  store_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierCreate {
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  notes?: string;
  is_active?: boolean;
}

export type SupplierUpdate = Partial<SupplierCreate>;

function authHeaders(storeId: string): Record<string, string> {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Store-ID": storeId,
  };
}

export async function getSuppliers(storeId: string): Promise<Supplier[]> {
  const res = await fetch(`${API_URL}/suppliers/`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al obtener proveedores");
  return res.json();
}

export async function createSupplier(
  storeId: string,
  data: SupplierCreate
): Promise<Supplier> {
  const res = await fetch(`${API_URL}/suppliers/`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al crear proveedor");
  return res.json();
}

export async function updateSupplier(
  storeId: string,
  supplierId: string,
  data: SupplierUpdate
): Promise<Supplier> {
  const res = await fetch(`${API_URL}/suppliers/${supplierId}`, {
    method: "PATCH",
    headers: authHeaders(storeId),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Error al actualizar proveedor");
  return res.json();
}

export async function deleteSupplier(
  storeId: string,
  supplierId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/suppliers/${supplierId}`, {
    method: "DELETE",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al eliminar proveedor");
}
