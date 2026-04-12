"use client";

import { Check } from "lucide-react";
import type { ThemeConfig } from "@/lib/api/themes";

interface ThemePreviewCardProps {
  id: string;
  name: string;
  description: string;
  isCurrent: boolean;
  defaultTokens?: ThemeConfig;
  onSelect: () => void;
  isLoading?: boolean;
}

interface PreviewColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

function renderMiniLayout(id: string, colors: PreviewColors) {
  const headerBar = (
    <div className="flex items-center justify-between px-2 py-1" style={{ backgroundColor: colors.primary + "30" }}>
      <div className="w-5 h-1.5 rounded-full" style={{ backgroundColor: colors.primary }} />
      <div className="flex gap-1">
        <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.4 }} />
        <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.4 }} />
        <div className="w-3 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.4 }} />
      </div>
    </div>
  );

  const footer = (
    <div className="mt-auto px-2 py-1 flex items-center justify-between" style={{ backgroundColor: colors.primary + "15" }}>
      <div className="w-4 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.2 }} />
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.2 }} />
      </div>
    </div>
  );

  const productCard = (color: string, width = "w-full") => (
    <div className={`${width} flex flex-col`}>
      <div className="w-full aspect-[4/3] rounded-sm mb-0.5" style={{ backgroundColor: color + "25", border: `1px solid ${color}20` }} />
      <div className="w-3/4 h-0.5 rounded-full mt-0.5" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
      <div className="w-1/2 h-0.5 rounded-full mt-0.5" style={{ backgroundColor: colors.accent, opacity: 0.5 }} />
    </div>
  );

  switch (id) {
    case "streetwear":
      return (
        <div className="flex flex-col h-full w-full overflow-hidden rounded-md" style={{ backgroundColor: colors.background }}>
          {headerBar}
          <div className="mx-2 mt-1 py-3 rounded-sm flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
            <div className="w-10 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.9 }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5 px-2 py-1.5 flex-1">
            {productCard(colors.primary)}
            {productCard(colors.secondary)}
          </div>
          {footer}
        </div>
      );

    case "boutique":
      return (
        <div className="flex flex-col h-full w-full overflow-hidden rounded-md" style={{ backgroundColor: colors.background }}>
          {headerBar}
          <div className="mx-2 mt-1 flex gap-1.5 py-1">
            <div className="flex-1 flex flex-col justify-center gap-1 px-1">
              <div className="w-8 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.6 }} />
              <div className="w-12 h-0.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
              <div className="w-5 h-1.5 rounded-sm mt-0.5" style={{ backgroundColor: colors.primary }} />
            </div>
            <div className="w-10 h-8 rounded-sm" style={{ backgroundColor: colors.secondary + "30", border: `1px solid ${colors.secondary}20` }} />
          </div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1 flex-1">
            {productCard(colors.primary)}
            {productCard(colors.secondary)}
            {productCard(colors.accent)}
          </div>
          {footer}
        </div>
      );

    case "tech":
      return (
        <div className="flex flex-col h-full w-full overflow-hidden rounded-md" style={{ backgroundColor: colors.background }}>
          {headerBar}
          <div
            className="mx-2 mt-1 py-3 rounded-sm flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.9 }} />
              <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1.5 flex-1">
            {productCard(colors.primary)}
            {productCard(colors.secondary)}
            {productCard(colors.accent)}
          </div>
          {footer}
        </div>
      );

    case "artesanal":
      return (
        <div className="flex flex-col h-full w-full overflow-hidden rounded-md" style={{ backgroundColor: colors.background }}>
          {headerBar}
          <div className="mx-2 mt-1 py-2 flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <div className="w-3 h-px" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.accent, opacity: 0.5 }} />
              <div className="w-3 h-px" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
            </div>
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.6 }} />
            <div className="flex items-center gap-1">
              <div className="w-3 h-px" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.accent, opacity: 0.5 }} />
              <div className="w-3 h-px" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1 flex-1">
            {productCard(colors.primary)}
            {productCard(colors.secondary)}
            {productCard(colors.accent)}
          </div>
          {footer}
        </div>
      );

    default:
      return (
        <div className="flex flex-col h-full w-full overflow-hidden rounded-md" style={{ backgroundColor: colors.background }}>
          {headerBar}
          <div className="mx-2 mt-1 py-3 rounded-sm flex items-center justify-center" style={{ backgroundColor: colors.primary + "20" }}>
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
          </div>
          <div className="grid grid-cols-3 gap-1 px-2 py-1.5 flex-1">
            {productCard(colors.primary)}
            {productCard(colors.secondary)}
            {productCard(colors.accent)}
          </div>
          {footer}
        </div>
      );
  }
}

export function ThemePreviewCard({
  id,
  name,
  description,
  isCurrent,
  defaultTokens,
  onSelect,
  isLoading = false,
}: ThemePreviewCardProps) {
  const colors: PreviewColors = {
    primary: defaultTokens?.colors?.primary || "#6366F1",
    secondary: defaultTokens?.colors?.secondary || "#8B5CF6",
    accent: defaultTokens?.colors?.accent || "#22C55E",
    background: defaultTokens?.colors?.background || "#0F172A",
    text: defaultTokens?.colors?.text || "#F8FAFC",
  };

  return (
    <div
      className={`relative p-6 rounded-xl border transition cursor-pointer ${
        isCurrent
          ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
          : "border-gray-200 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50"
      }`}
    >
      {isCurrent && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium z-10">
          <Check className="w-3.5 h-3.5" />
          Actual
        </div>
      )}

      <div className="h-36 rounded-lg mb-4 overflow-hidden border border-gray-100">
        {renderMiniLayout(id, colors)}
      </div>

      <h3 className="font-display font-semibold text-gray-900 mb-1">{name}</h3>
      <p className="text-gray-400 text-sm mb-4">{description}</p>

      <button
        onClick={onSelect}
        disabled={isCurrent || isLoading}
        className={`w-full py-2.5 rounded-lg font-medium transition text-sm ${
          isCurrent
            ? "bg-indigo-50 text-indigo-600 cursor-default"
            : "bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
        }`}
      >
        {isLoading ? "Aplicando..." : isCurrent ? "En uso" : "Aplicar"}
      </button>
    </div>
  );
}
