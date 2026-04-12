import {
  Package,
  Megaphone,
  FileText,
  MessageSquare,
  Mail,
  Zap,
  Image,
  Layers,
  type LucideIcon,
} from "lucide-react";

export interface HybridCombo {
  label: string;
  icon: LucideIcon;
  primary: string;
  secondary: string;
}

const COMBOS: [string, string, HybridCombo][] = [
  ["hero", "image_slider", { label: "Hero con Slider", icon: Layers, primary: "hero", secondary: "image_slider" }],
  ["hero", "video", { label: "Hero con Video", icon: Layers, primary: "hero", secondary: "video" }],
  ["featured_products", "video", { label: "Productos + Video", icon: Package, primary: "featured_products", secondary: "video" }],
  ["featured_products", "banner", { label: "Productos + Banner", icon: Package, primary: "featured_products", secondary: "banner" }],
  ["banner", "image_slider", { label: "Banner con Slider", icon: Megaphone, primary: "banner", secondary: "image_slider" }],
  ["banner", "video", { label: "Banner con Video", icon: Megaphone, primary: "banner", secondary: "video" }],
  ["custom_text", "video", { label: "Texto + Video", icon: FileText, primary: "custom_text", secondary: "video" }],
  ["testimonials", "video", { label: "Testimonios + Video", icon: MessageSquare, primary: "testimonials", secondary: "video" }],
  ["newsletter", "video", { label: "Newsletter + Video", icon: Mail, primary: "newsletter", secondary: "video" }],
  ["drops", "video", { label: "Drops + Video", icon: Zap, primary: "drops", secondary: "video" }],
  ["image_slider", "video", { label: "Slider + Video", icon: Image, primary: "image_slider", secondary: "video" }],
];

function sortKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}

const HYBRID_MAP = new Map<string, HybridCombo>();
for (const [a, b, combo] of COMBOS) {
  HYBRID_MAP.set(sortKey(a, b), combo);
}

export function canMerge(typeA: string, typeB: string): boolean {
  if (typeA === "hybrid" || typeB === "hybrid") return false;
  return HYBRID_MAP.has(sortKey(typeA, typeB));
}

export function getHybridKey(typeA: string, typeB: string): string | null {
  const key = sortKey(typeA, typeB);
  return HYBRID_MAP.has(key) ? key : null;
}

export function getHybridCombo(typeA: string, typeB: string): HybridCombo | null {
  return HYBRID_MAP.get(sortKey(typeA, typeB)) ?? null;
}

export function getHybridComboByKey(key: string): HybridCombo | null {
  return HYBRID_MAP.get(key) ?? null;
}

export function getComboFromTypes(types: [string, string]): HybridCombo | null {
  return getHybridCombo(types[0], types[1]);
}
