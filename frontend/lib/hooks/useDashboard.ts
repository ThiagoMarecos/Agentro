"use client";

import { useEffect, useState } from "react";
import {
  getDashboardSummary,
  getDashboardActivity,
  type DashboardSummary,
  type ActivityItem,
} from "@/lib/api/dashboard";

export function useDashboard(storeId: string | null) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setSummary(null);
      setActivity([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setError(null);
    setIsLoading(true);

    Promise.all([
      getDashboardSummary(storeId),
      getDashboardActivity(storeId),
    ])
      .then(([s, a]) => {
        if (!cancelled) {
          setSummary(s);
          setActivity(a);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar dashboard");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const refresh = () => {
    if (storeId) {
      getDashboardSummary(storeId).then(setSummary);
      getDashboardActivity(storeId).then(setActivity);
    }
  };

  return { summary, activity, isLoading, error, refresh };
}
