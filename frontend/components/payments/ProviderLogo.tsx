"use client";

import { useState } from "react";
import type { ProviderInfo } from "@/lib/api/payments";

interface Props {
  provider: ProviderInfo;
  size?: number; // px
  rounded?: "md" | "lg" | "full";
}

/**
 * Renderiza el logo del provider de pago. Prioriza:
 *   1. logo_url directa si existe
 *   2. logo.clearbit.com con logo_domain
 *   3. fallback: cuadrado con color de marca + emoji icon
 *
 * Si una imagen falla, hace fallback al siguiente paso. El fondo siempre
 * usa el color brand del provider para que se vea consistente.
 */
export function ProviderLogo({ provider, size = 40, rounded = "lg" }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(provider.logo_url ? 0 : provider.logo_domain ? 1 : 2);

  const radius = rounded === "full" ? "9999px" : rounded === "md" ? "8px" : "12px";
  const bg = provider.color || "#475569";

  const src =
    step === 0 && provider.logo_url
      ? provider.logo_url
      : step === 1 && provider.logo_domain
      ? `https://logo.clearbit.com/${provider.logo_domain}`
      : null;

  if (src) {
    return (
      <div
        className="grid place-items-center bg-white border border-gray-200 overflow-hidden shrink-0"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={provider.name}
          className="object-contain"
          style={{ width: size * 0.82, height: size * 0.82 }}
          onError={() => setStep((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : 2))}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Fallback: emoji sobre fondo de color brand
  return (
    <div
      className="grid place-items-center text-white shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
        fontSize: size * 0.5,
      }}
      title={provider.name}
    >
      {provider.icon}
    </div>
  );
}
