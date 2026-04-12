"use client";

import { useEffect, useState } from "react";
import {
  getStoreSettings,
  updateStoreSettings,
  type StoreSettings,
  type StoreSettingsUpdate,
} from "@/lib/api/settings";

export function useStoreSettings(storeId: string | null) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setIsLoading(true);

    getStoreSettings(storeId)
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar configuración");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const update = async (data: StoreSettingsUpdate) => {
    if (!storeId) throw new Error("No hay tienda seleccionada");
    const updated = await updateStoreSettings(storeId, data);
    setSettings(updated);
    return updated;
  };

  const refresh = () => {
    if (storeId) {
      getStoreSettings(storeId).then(setSettings);
    }
  };

  return { settings, update, isLoading, error, refresh };
}
