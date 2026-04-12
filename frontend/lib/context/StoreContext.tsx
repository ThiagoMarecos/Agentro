"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { authFetch } from "@/lib/auth";

const API_URL = "/api/v1";
const STORE_KEY = "nexora_current_store_id";

export interface Store {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  country: string | null;
  currency: string;
  language: string;
  template_id: string | null;
  is_active: boolean;
  logo_url?: string | null;
  favicon_url?: string | null;
  og_image_url?: string | null;
}

interface StoreContextType {
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store | null) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

function getSavedStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORE_KEY);
}

function saveStoreId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(STORE_KEY, id);
  } else {
    localStorage.removeItem(STORE_KEY);
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { token, isLoading: authLoading } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedForToken = useRef<string | null>(null);

  const setCurrentStore = useCallback((store: Store | null) => {
    setCurrentStoreState(store);
    saveStoreId(store?.id ?? null);
  }, []);

  const fetchStores = useCallback(async () => {
    if (authLoading) return;
    if (!token) {
      setStores([]);
      setCurrentStoreState(null);
      setIsLoading(false);
      fetchedForToken.current = null;
      return;
    }

    // Siempre mostrar loading cuando hay token y vamos a fetchear
    setIsLoading(true);

    try {
      const res = await authFetch(`${API_URL}/stores`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data: Store[] = await res.json();
        setStores(data);

        if (data.length > 0) {
          // Intentar restaurar la tienda guardada en localStorage
          const savedId = getSavedStoreId();
          setCurrentStoreState((prev) => {
            // Si ya hay una seleccionada y sigue existiendo, mantenerla
            if (prev) {
              const updated = data.find((s) => s.id === prev.id);
              if (updated) return updated;
            }
            // Si hay una guardada en localStorage, usarla
            if (savedId) {
              const saved = data.find((s) => s.id === savedId);
              if (saved) return saved;
            }
            // Fallback: primera tienda
            return data[0];
          });
        } else {
          setCurrentStoreState(null);
        }

        fetchedForToken.current = token;
      }
    } catch {
      setStores([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, authLoading]);

  useEffect(() => {
    // Solo re-fetchear si el token cambió realmente
    if (!authLoading && token !== fetchedForToken.current) {
      fetchStores();
    } else if (!authLoading && !token) {
      setStores([]);
      setCurrentStoreState(null);
      setIsLoading(false);
    }
  }, [token, authLoading, fetchStores]);

  return (
    <StoreContext.Provider
      value={{
        stores,
        currentStore,
        setCurrentStore,
        isLoading,
        refresh: fetchStores,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
