"use client";

/**
 * Tour interactivo del dashboard para nuevos usuarios.
 * - Spotlight con cutout SVG sobre el elemento target
 * - Tooltip animado con texto + controles
 * - Smooth transitions entre steps
 * - Se muestra UNA SOLA VEZ por usuario (localStorage)
 */

import { useEffect, useState, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export interface TourStep {
  /** CSS selector del elemento a iluminar. Si no se encuentra, el step se saltea. */
  selector?: string;
  /** Si true, el tooltip se centra en pantalla (sin spotlight) */
  centered?: boolean;
  title: string;
  body: string;
  /** Posición del tooltip respecto al spotlight: auto-elige el lado con más espacio. */
  placement?: "auto" | "right" | "bottom" | "left" | "top";
}

interface DashboardTourProps {
  steps: TourStep[];
  storageKey: string;
  /** Si true, fuerza mostrar el tour aunque ya se haya visto (modo "Repetir tour") */
  forceShow?: boolean;
  onClose?: () => void;
}

const PADDING = 10;
const TOOLTIP_W = 340;
const TOOLTIP_OFFSET = 18;

function getBox(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

function pickPlacement(
  rect: DOMRect,
  placement: TourStep["placement"]
): "right" | "bottom" | "left" | "top" {
  if (placement && placement !== "auto") return placement;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceRight = vw - rect.right;
  const spaceLeft = rect.left;
  const spaceBottom = vh - rect.bottom;
  const spaceTop = rect.top;
  const max = Math.max(spaceRight, spaceLeft, spaceBottom, spaceTop);
  if (max === spaceBottom) return "bottom";
  if (max === spaceRight) return "right";
  if (max === spaceTop) return "top";
  return "left";
}

function getTooltipPosition(
  rect: DOMRect | null,
  placement: "right" | "bottom" | "left" | "top" | "center",
  tooltipEl: HTMLElement | null
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const th = tooltipEl?.offsetHeight ?? 220;
  const tw = tooltipEl?.offsetWidth ?? TOOLTIP_W;

  if (!rect || placement === "center") {
    return {
      top: Math.max(20, (vh - th) / 2),
      left: Math.max(20, (vw - tw) / 2),
    };
  }

  switch (placement) {
    case "right": {
      const top = clamp(rect.top + rect.height / 2 - th / 2, 16, vh - th - 16);
      const left = Math.min(rect.right + TOOLTIP_OFFSET, vw - tw - 16);
      return { top, left };
    }
    case "left": {
      const top = clamp(rect.top + rect.height / 2 - th / 2, 16, vh - th - 16);
      const left = Math.max(16, rect.left - tw - TOOLTIP_OFFSET);
      return { top, left };
    }
    case "bottom": {
      const top = Math.min(rect.bottom + TOOLTIP_OFFSET, vh - th - 16);
      const left = clamp(rect.left + rect.width / 2 - tw / 2, 16, vw - tw - 16);
      return { top, left };
    }
    case "top": {
      const top = Math.max(16, rect.top - th - TOOLTIP_OFFSET);
      const left = clamp(rect.left + rect.width / 2 - tw / 2, 16, vw - tw - 16);
      return { top, left };
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function DashboardTour({
  steps,
  storageKey,
  forceShow,
  onClose,
}: DashboardTourProps) {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipEl, setTooltipEl] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Decidir si arrancar el tour
  useEffect(() => {
    if (!mounted) return;
    if (forceShow) {
      setActive(true);
      return;
    }
    try {
      const seen = window.localStorage.getItem(storageKey);
      if (!seen) {
        // pequeño delay para que el dashboard termine de renderear
        const t = setTimeout(() => setActive(true), 500);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, [mounted, forceShow, storageKey]);

  const step = steps[idx];

  // Calcular rect del target cuando cambia el step / resize / scroll
  const updateRect = useCallback(() => {
    if (!step || step.centered || !step.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    // Scroll el target a la vista si está fuera
    const r = getBox(el);
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setRect(getBox(el)), 350);
    } else {
      setRect(r);
    }
  }, [step]);

  useLayoutEffect(() => {
    if (!active) return;
    updateRect();
    const onResize = () => updateRect();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, updateRect]);

  // Saltar steps que no encuentran su target
  useEffect(() => {
    if (!active || !step) return;
    if (step.centered) return;
    if (step.selector && !document.querySelector(step.selector)) {
      // Si el step apunta a algo que no existe (ej: feature no aplica), saltarlo
      if (idx < steps.length - 1) setIdx((i) => i + 1);
    }
  }, [active, step, idx, steps.length]);

  const close = useCallback(
    (markSeen = true) => {
      setActive(false);
      if (markSeen) {
        try {
          window.localStorage.setItem(storageKey, "1");
        } catch {
          /* ignore */
        }
      }
      onClose?.();
    },
    [storageKey, onClose]
  );

  const next = () => {
    if (idx >= steps.length - 1) {
      close(true);
    } else {
      setIdx((i) => i + 1);
    }
  };
  const prev = () => idx > 0 && setIdx((i) => i - 1);

  // Keyboard nav
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !active || !step) return null;

  const placement = step.centered
    ? "center"
    : rect
    ? pickPlacement(rect, step.placement)
    : "center";
  const tt = getTooltipPosition(rect, placement as any, tooltipEl);

  // Calcular cutout para el spotlight
  const spotlightR = rect
    ? {
        x: rect.left - PADDING,
        y: rect.top - PADDING,
        w: rect.width + PADDING * 2,
        h: rect.height + PADDING * 2,
      }
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      style={{ pointerEvents: "auto" }}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop con cutout SVG */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: "auto" }}
        onClick={() => close(true)}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightR && (
              <rect
                x={spotlightR.x}
                y={spotlightR.y}
                width={spotlightR.w}
                height={spotlightR.h}
                rx={14}
                ry={14}
                fill="black"
                style={{
                  transition: "x 0.4s cubic-bezier(0.4,0,0.2,1), y 0.4s cubic-bezier(0.4,0,0.2,1), width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            )}
          </mask>
          <filter id="tour-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(5, 6, 15, 0.78)"
          style={{ backdropFilter: "blur(2px)" }}
          mask="url(#tour-mask)"
        />
        {/* Glow ring alrededor del spotlight */}
        {spotlightR && (
          <rect
            x={spotlightR.x}
            y={spotlightR.y}
            width={spotlightR.w}
            height={spotlightR.h}
            rx={14}
            ry={14}
            fill="none"
            stroke="rgba(179, 155, 255, 0.9)"
            strokeWidth={2}
            filter="url(#tour-glow)"
            style={{
              transition: "x 0.4s cubic-bezier(0.4,0,0.2,1), y 0.4s cubic-bezier(0.4,0,0.2,1), width 0.4s cubic-bezier(0.4,0,0.2,1), height 0.4s cubic-bezier(0.4,0,0.2,1)",
              animation: "tourGlow 2s ease-in-out infinite",
            }}
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        ref={setTooltipEl}
        className="absolute"
        style={{
          top: tt.top,
          left: tt.left,
          width: TOOLTIP_W,
          maxWidth: "calc(100vw - 32px)",
          transition: "top 0.35s cubic-bezier(0.4,0,0.2,1), left 0.35s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: "auto",
        }}
      >
        <div
          className="relative rounded-2xl p-5 text-white shadow-2xl"
          style={{
            background:
              "radial-gradient(120% 60% at 50% 0%, rgba(139,111,255,0.16) 0%, transparent 55%), linear-gradient(180deg, rgba(17,19,42,0.95) 0%, rgba(10,11,26,0.95) 100%)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(139,111,255,0.18), 0 40px 90px -20px rgba(0,0,0,0.85), 0 0 120px -20px rgba(139,111,255,0.35)",
            animation: "tourTipRise 0.35s cubic-bezier(0.2,0.8,0.2,1) both",
          }}
        >
          {/* Top gloss */}
          <div
            className="absolute left-[15%] right-[15%] -top-px h-px pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(179,155,255,0.8) 50%, transparent)",
            }}
          />

          {/* Header */}
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-violet-300">
                Tour · {idx + 1} de {steps.length}
              </div>
              <h3 className="text-base font-semibold leading-tight mt-1">
                {step.title}
              </h3>
            </div>
            <button
              onClick={() => close(true)}
              className="flex-shrink-0 -mt-1 -mr-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Cerrar tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <p className="text-sm text-slate-200/90 leading-relaxed mb-4">
            {step.body}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === idx ? 22 : 6,
                  background:
                    i === idx
                      ? "linear-gradient(90deg, #8b6fff, #b39bff)"
                      : i < idx
                      ? "rgba(179,155,255,0.4)"
                      : "rgba(255,255,255,0.15)",
                }}
                aria-label={`Ir al paso ${i + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => close(true)}
              className="text-xs text-slate-400 hover:text-white transition px-2 py-1.5"
            >
              Saltear tour
            </button>
            <div className="flex items-center gap-2">
              {idx > 0 && (
                <button
                  onClick={prev}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 text-slate-300 hover:bg-white/5 hover:border-white/25 transition text-xs font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
              )}
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-[#05060f] hover:bg-violet-200 hover:text-[#05060f] transition-all text-xs font-semibold shadow-[0_0_22px_-4px_rgba(139,111,255,0.6)]"
              >
                {idx === steps.length - 1 ? "Listo" : "Siguiente"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes tourGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes tourTipRise {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
