"use client";

import { useEffect, useState } from "react";
import {
  getStoreFeatures,
  type FeatureKey,
  type StoreFeatures,
} from "@/lib/api/billing";

// Cache simple in-memory por storeId. Las features no cambian frecuentemente
// (solo al cambiar de plan), así que cachear por sesión es razonable.
const featuresCache = new Map<string, StoreFeatures>();
const pendingRequests = new Map<string, Promise<StoreFeatures>>();

function fetchFeaturesCached(storeId: string): Promise<StoreFeatures> {
  const cached = featuresCache.get(storeId);
  if (cached) return Promise.resolve(cached);

  const pending = pendingRequests.get(storeId);
  if (pending) return pending;

  const promise = getStoreFeatures(storeId)
    .then((features) => {
      featuresCache.set(storeId, features);
      pendingRequests.delete(storeId);
      return features;
    })
    .catch((err) => {
      pendingRequests.delete(storeId);
      throw err;
    });

  pendingRequests.set(storeId, promise);
  return promise;
}

/** Limpia el cache — usar después de upgradear plan o cambios de tier. */
export function invalidateFeaturesCache(storeId?: string) {
  if (storeId) {
    featuresCache.delete(storeId);
  } else {
    featuresCache.clear();
  }
}

/**
 * Hook principal de feature gating frontend.
 *
 * Devuelve:
 *   - hasFeature(key): true si el store puede usar esa feature
 *   - features: el objeto completo de StoreFeatures
 *   - isLoading: true mientras carga la primera vez
 *   - error: mensaje de error si falló
 *
 * Cuando el sistema está en hibernación (is_hibernating=true), hasFeature
 * siempre devuelve true — el backend ya lo decide así.
 */
export function useFeatureAccess(storeId: string | null) {
  const [features, setFeatures] = useState<StoreFeatures | null>(
    storeId ? featuresCache.get(storeId) ?? null : null,
  );
  const [isLoading, setIsLoading] = useState(!features);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setFeatures(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setIsLoading(!featuresCache.has(storeId));

    fetchFeaturesCached(storeId)
      .then((data) => {
        if (!cancelled) {
          setFeatures(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar features");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const hasFeature = (key: FeatureKey): boolean => {
    if (!features) return false;
    return features.available.includes(key);
  };

  return {
    features,
    hasFeature,
    isLoading,
    error,
    isHibernating: features?.is_hibernating ?? false,
    tier: features?.tier ?? null,
    isBetaUser: features?.is_beta_user ?? false,
  };
}
