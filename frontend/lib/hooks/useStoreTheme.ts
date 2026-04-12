"use client";

import { useEffect, useState } from "react";
import {
  getThemePresets,
  getStoreTheme,
  updateStoreTheme,
  applyThemePreset,
  type StoreTheme,
  type ThemePreset,
  type ThemeConfig,
} from "@/lib/api/themes";

export function useStoreTheme(storeId: string | null) {
  const [theme, setTheme] = useState<StoreTheme | null>(null);
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setTheme(null);
      setPresets([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setIsLoading(true);

    Promise.all([getStoreTheme(storeId), getThemePresets()])
      .then(([t, p]) => {
        if (!cancelled) {
          setTheme(t);
          setPresets(p);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar tema");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const updateTheme = async (data: {
    template_name?: string;
    custom_config?: Partial<ThemeConfig>;
  }) => {
    if (!storeId) throw new Error("No hay tienda seleccionada");
    const updated = await updateStoreTheme(storeId, data);
    setTheme(updated);
    return updated;
  };

  const applyPreset = async (presetId: string) => {
    if (!storeId) throw new Error("No hay tienda seleccionada");
    const updated = await applyThemePreset(storeId, presetId);
    setTheme(updated);
    return updated;
  };

  const refresh = () => {
    if (storeId) {
      getStoreTheme(storeId).then(setTheme);
    }
  };

  return { theme, presets, updateTheme, applyPreset, isLoading, error, refresh };
}
