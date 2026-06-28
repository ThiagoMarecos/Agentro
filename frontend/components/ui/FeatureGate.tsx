"use client";

/**
 * FeatureGate — Wrapper que muestra contenido SOLO si el store tiene acceso
 * a la feature indicada. Si no, muestra un fallback (default: badge "Upgrade").
 *
 * Uso típico:
 *
 *   <FeatureGate feature="custom_prompt" storeId={storeId}>
 *     <PromptEditor />
 *   </FeatureGate>
 *
 * Cuando el sistema está en hibernación, SIEMPRE renderiza children (el
 * backend devuelve todas las features como disponibles).
 *
 * Para ocultar completamente (sin mostrar mensaje) usar `hideWhenLocked`.
 *
 * Para casos donde solo necesitás bloquear un botón, usar `<FeatureGateInline>`.
 */

import { ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  useFeatureAccess,
} from "@/lib/hooks/useFeatureAccess";
import type { FeatureKey } from "@/lib/api/billing";

interface FeatureGateProps {
  feature: FeatureKey;
  storeId: string | null;
  children: ReactNode;
  /** Qué mostrar cuando NO tiene acceso. Si null, muestra el fallback default. */
  fallback?: ReactNode;
  /** Si true, no renderiza nada cuando no tiene acceso (sin mensaje). */
  hideWhenLocked?: boolean;
  /** Texto custom del mensaje de upgrade. */
  upgradeMessage?: string;
}

function DefaultLockedFallback({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      <Lock className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function FeatureGate({
  feature,
  storeId,
  children,
  fallback,
  hideWhenLocked = false,
  upgradeMessage,
}: FeatureGateProps) {
  const { hasFeature, isLoading } = useFeatureAccess(storeId);

  if (isLoading) {
    // Durante la carga inicial, no flashear contenido. Render mínimo.
    return null;
  }

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <DefaultLockedFallback
      message={upgradeMessage ?? "Esta función está disponible en un plan superior."}
    />
  );
}

/**
 * Versión inline para deshabilitar botones o controles individuales.
 * Renderiza children con prop `locked: boolean` si la feature no está disponible.
 *
 * Uso:
 *   <FeatureGateInline feature="custom_prompt" storeId={storeId}>
 *     {({ locked }) => (
 *       <button disabled={locked} title={locked ? "Upgrade para usar" : ""}>
 *         Editar prompt
 *       </button>
 *     )}
 *   </FeatureGateInline>
 */
interface FeatureGateInlineProps {
  feature: FeatureKey;
  storeId: string | null;
  children: (state: { locked: boolean; isLoading: boolean }) => ReactNode;
}

export function FeatureGateInline({
  feature,
  storeId,
  children,
}: FeatureGateInlineProps) {
  const { hasFeature, isLoading } = useFeatureAccess(storeId);
  const locked = !isLoading && !hasFeature(feature);
  return <>{children({ locked, isLoading })}</>;
}
