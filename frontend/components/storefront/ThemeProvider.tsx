"use client";

import { useEffect, useMemo } from "react";

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    surface?: string;
    border?: string;
    success?: string;
    error?: string;
    warning?: string;
  };
  typography: {
    font_family: string;
    heading_font?: string;
    heading_scale: string;
    heading_weight?: string;
    body_size?: string;
  };
  button_style: string;
  card_style: string;
  hero_style: string;
  layout_density: string;
  custom_banner?: string;
  custom_css?: string;
  color_mode?: string;
  sections?: any[];
  section_toggles?: Record<string, boolean>;
}

interface ThemeProviderProps {
  config: ThemeConfig;
  children: React.ReactNode;
}

const BUTTON_RADIUS: Record<string, string> = {
  rounded: "8px",
  square: "2px",
  pill: "9999px",
};

const CARD_RADIUS: Record<string, string> = {
  elevated: "16px",
  flat: "8px",
  outlined: "12px",
};

const CARD_SHADOW: Record<string, string> = {
  elevated: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  flat: "none",
  outlined: "none",
};

const CARD_BORDER: Record<string, string> = {
  elevated: "none",
  flat: "none",
  outlined: "1px solid var(--color-border)",
};

function buildFontUrl(families: string[]): string {
  const encoded = families
    .map((f) => f.replace(/ /g, "+"))
    .map((f) => `family=${f}:wght@300;400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${encoded}&display=swap`;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const full = cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastForeground(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.4 ? "#1a1a1a" : "#ffffff";
}

function isDarkBackground(bgHex: string): boolean {
  return relativeLuminance(bgHex) < 0.2;
}

function mixColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (factor > 0 ? (255 - c) * factor : c * factor));
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  return `#${[r, g, b].map((c) => clamp(mix(c)).toString(16).padStart(2, "0")).join("")}`;
}

export function ThemeProvider({ config, children }: ThemeProviderProps) {
  const { colors, typography, button_style, card_style, custom_css } = config;

  useEffect(() => {
    const families = [typography.font_family];
    if (typography.heading_font && typography.heading_font !== typography.font_family) {
      families.push(typography.heading_font);
    }

    const href = buildFontUrl(families);
    const existing = document.querySelector(`link[href="${href}"]`);
    if (!existing) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [typography.font_family, typography.heading_font]);

  const cssVars = useMemo(() => {
    const dark = isDarkBackground(colors.background);
    const surface = colors.surface || (dark ? mixColor(colors.background, 0.1) : mixColor(colors.background, -0.03));
    const border = colors.border || (dark ? mixColor(colors.background, 0.2) : colors.text + "22");

    const surfaceAlt = dark ? mixColor(colors.background, 0.06) : mixColor(colors.background, -0.04);
    const surfaceCard = dark ? mixColor(colors.background, 0.14) : "#ffffff";
    const mutedText = dark ? mixColor(colors.text, -0.25) : mixColor(colors.text, 0.4);
    const subtleText = dark ? mixColor(colors.text, -0.4) : mixColor(colors.text, 0.55);
    const hoverBg = dark ? mixColor(colors.background, 0.15) : mixColor(colors.background, -0.06);
    const pillBg = dark ? mixColor(colors.primary, -0.7) : mixColor(colors.primary, 0.85);
    const pillText = dark ? mixColor(colors.primary, 0.5) : mixColor(colors.primary, -0.2);

    const BODY_SIZE_MAP: Record<string, string> = {
      small: "14px",
      normal: "16px",
      large: "18px",
    };

    return {
      "--color-primary": colors.primary,
      "--color-secondary": colors.secondary,
      "--color-accent": colors.accent,
      "--color-background": colors.background,
      "--color-text": colors.text,
      "--color-surface": surface,
      "--color-border": border,
      "--color-success": colors.success || "#22C55E",
      "--color-error": colors.error || "#EF4444",
      "--color-warning": colors.warning || "#F59E0B",
      "--color-primary-fg": contrastForeground(colors.primary),
      "--color-accent-fg": contrastForeground(colors.accent),
      "--color-surface-alt": surfaceAlt,
      "--color-surface-card": surfaceCard,
      "--color-text-muted": mutedText,
      "--color-text-subtle": subtleText,
      "--color-hover-bg": hoverBg,
      "--color-pill-bg": pillBg,
      "--color-pill-text": pillText,
      "--font-family": `"${typography.font_family}", sans-serif`,
      "--font-heading": `"${typography.heading_font || typography.font_family}", sans-serif`,
      "--font-heading-weight": typography.heading_weight || "bold",
      "--font-body-size": BODY_SIZE_MAP[typography.body_size || "normal"] || "16px",
      "--radius-button": BUTTON_RADIUS[button_style] || "8px",
      "--radius-card": CARD_RADIUS[card_style] || "8px",
      "--shadow-card": CARD_SHADOW[card_style] || "none",
      "--border-card": CARD_BORDER[card_style] || "none",
    } as Record<string, string>;
  }, [colors, typography, button_style, card_style]);

  const colorMode = config.color_mode;
  const dataTheme = colorMode === "dark" ? "dark" : colorMode === "light" ? "light" : undefined;

  return (
    <div style={cssVars as React.CSSProperties} className="min-h-full" {...(dataTheme ? { "data-theme": dataTheme } : {})}>
      {custom_css && <style dangerouslySetInnerHTML={{ __html: custom_css }} />}
      {children}
    </div>
  );
}
