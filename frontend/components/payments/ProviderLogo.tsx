"use client";

import { useState } from "react";
import type { ProviderInfo } from "@/lib/api/payments";

interface Props {
  provider: ProviderInfo;
  size?: number; // px
  rounded?: "md" | "lg" | "full";
}

/**
 * Render del logo del provider con fallback en cascada:
 *   1. logo_url directa (Wikimedia / CDN propio del provider)
 *   2. logo.clearbit.com con logo_domain
 *   3. Iniciales del nombre sobre color brand (estilo Notion/Slack)
 *
 * El paso 3 es 100% confiable y se ve profesional cuando los otros fallan.
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

  // Fallback: iniciales del nombre sobre color brand
  // Tomamos hasta 2 iniciales (ej: "Mercado Pago" → "MP", "Pix" → "P", "Banco GNB" → "BG").
  const words = (provider.name || "?")
    .replace(/[()]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const initials =
    words.length === 1
      ? words[0].substring(0, 2).toUpperCase()
      : (words[0][0] + words[1][0]).toUpperCase();

  return (
    <div
      className="grid place-items-center text-white shrink-0 font-bold tracking-tight select-none"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${bg}, ${shade(bg, -18)})`,
        fontSize: size * 0.42,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
      title={provider.name}
    >
      {initials}
    </div>
  );
}

/** Oscurece (o aclara) un color hex en X% — usado para gradient sutil. */
function shade(hex: string, percent: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const adjust = (c: number) => Math.max(0, Math.min(255, Math.round(c + (c * percent) / 100)));
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}
