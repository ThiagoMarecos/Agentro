"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  login as authLogin,
  register as authRegister,
  getMe,
  refreshToken,
  logout as authLogout,
  getStoredToken,
  clearTokens,
} from "@/lib/auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    const t = getStoredToken();
    if (!t) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }
    try {
      // Refrescar primero para evitar 401: nunca enviar token expirado
      await refreshToken();
      const u = await getMe(false);
      setUser(u);
      setToken(getStoredToken());
    } catch {
      clearTokens();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  // Refresh proactivo cada 50 min: el token nunca expira mientras la app está abierta
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        await refreshToken();
        setToken(getStoredToken());
      } catch {
        clearTokens();
        setUser(null);
        setToken(null);
      }
    }, 25 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (email: string, password: string) => {
    await authLogin(email, password);
    await loadUser();
  };

  const register = async (email: string, password: string, fullName?: string) => {
    await authRegister(email, password, fullName);
    await loadUser();
  };

  const logout = () => {
    authLogout();
    setUser(null);
    setToken(null);
  };

  const refresh = async () => {
    try {
      await refreshToken();
      await loadUser();
    } catch {
      logout();
    }
  };

  const reloadUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, refresh, reloadUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
