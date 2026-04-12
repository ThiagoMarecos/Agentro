import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

export interface WhatsAppChannel {
  id: string;
  store_id: string;
  channel_type: string;
  is_active: boolean;
  instance_name: string | null;
  whatsapp_number: string | null;
  connection_status: string | null;
  profile_name: string | null;
}

export interface ConnectResponse {
  channel_id: string;
  instance_name: string;
  qr_code: string | null;
  pairing_code: string | null;
  status: string;
  message: string;
}

export interface QRCodeResponse {
  qr_code: string | null;
  pairing_code: string | null;
  instance_name: string;
  status: string;
}

export interface ConnectionState {
  instance_name: string;
  state: string;
  connection_status: string;
}

function authHeaders(storeId: string): Record<string, string> {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Store-ID": storeId,
  };
}

function parseError(text: string, fallback: string): string {
  try {
    const json = JSON.parse(text);
    return json.detail || fallback;
  } catch {
    return text || fallback;
  }
}

export async function getWhatsAppStatus(
  storeId: string
): Promise<WhatsAppChannel | null> {
  const res = await fetch(`${API_URL}/whatsapp/status`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data || null;
}

export async function connectWhatsApp(
  storeId: string,
  phoneNumber?: string
): Promise<ConnectResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/whatsapp/connect`, {
      method: "POST",
      headers: authHeaders(storeId),
      body: JSON.stringify({ phone_number: phoneNumber || null }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Intentá de nuevo.");
    }
    throw new Error("No se pudo conectar al servidor.");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(parseError(text, `Error ${res.status}`));
  }

  return res.json();
}

export async function getQRCode(storeId: string): Promise<QRCodeResponse> {
  const res = await fetch(`${API_URL}/whatsapp/qr`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(parseError(text, "Error al obtener QR"));
  }
  return res.json();
}

export async function getConnectionState(
  storeId: string
): Promise<ConnectionState> {
  const res = await fetch(`${API_URL}/whatsapp/connection-state`, {
    headers: authHeaders(storeId),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(parseError(text, "Error al obtener estado"));
  }
  return res.json();
}

export async function disconnectWhatsApp(storeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/whatsapp/disconnect`, {
    method: "POST",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al desconectar WhatsApp");
}

export async function removeWhatsApp(storeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/whatsapp/remove`, {
    method: "DELETE",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al eliminar WhatsApp");
}

export async function restartWhatsApp(storeId: string): Promise<void> {
  const res = await fetch(`${API_URL}/whatsapp/restart`, {
    method: "POST",
    headers: authHeaders(storeId),
  });
  if (!res.ok) throw new Error("Error al reiniciar WhatsApp");
}
