/**
 * Funciones de autenticación - llamadas a la API
 */

const API_URL = "/api/v1";
const TOKEN_KEY = "nexora_access_token";
const REFRESH_KEY = "nexora_refresh_token";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  is_verified: boolean;
  is_superadmin?: boolean;
}

export interface AuthMeResponse {
  user: User;
  memberships: Array<{ store_id: string; store_name: string; store_slug: string; role: string }>;
  current_store: { id: string; name: string; slug: string } | null;
  must_onboard: boolean;
  suggested_redirect: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function authFetch(
  url: string,
  options: RequestInit = {},
  retry = true
): Promise<Response> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 && retry) {
    try {
      await refreshToken();
      return authFetch(url, options, false);
    } catch {
      clearTokens();
      throw new Error("Sesión expirada");
    }
  }
  return res;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al iniciar sesión");
  }
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function register(
  email: string,
  password: string,
  full_name?: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al registrarse");
  }
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(retryOn401 = true): Promise<User> {
  const token = getStoredToken();
  if (!token) throw new Error("No autenticado");

  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401 && retryOn401) {
      try {
        await refreshToken();
        return getMe(false);
      } catch {
        clearTokens();
        throw new Error("Sesión expirada");
      }
    }
    if (res.status === 401) {
      clearTokens();
      throw new Error("Sesión expirada");
    }
    throw new Error("Error al obtener usuario");
  }
  const data: AuthMeResponse = await res.json();
  return data.user;
}

export async function refreshToken(): Promise<TokenResponse> {
  const refresh = getStoredRefreshToken();
  if (!refresh) throw new Error("No hay refresh token");

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    throw new Error("Sesión expirada");
  }
  const data: TokenResponse = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export function logout(): void {
  clearTokens();
}

export function getGoogleAuthUrl(state?: string): string {
  const url = `${API_URL}/auth/google`;
  if (state) return `${url}?state=${encodeURIComponent(state)}`;
  return url;
}

export async function getUserProfile(): Promise<{
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  auth_provider: string;
  is_verified: boolean;
  created_at: string | null;
}> {
  const res = await authFetch(`${API_URL}/users/me`);
  if (!res.ok) throw new Error("Error al obtener perfil");
  return res.json();
}

export async function updateProfile(data: { full_name?: string; avatar_url?: string | null }) {
  const res = await authFetch(`${API_URL}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al actualizar perfil");
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await authFetch(`${API_URL}/users/me/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al cambiar contraseña");
  }
  return res.json();
}

export async function deleteAccount() {
  const res = await authFetch(`${API_URL}/users/me`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Error al eliminar cuenta");
  }
  clearTokens();
  return res.json();
}
