"use client";

import {
  Search,
  Package,
  ShoppingCart,
  Truck,
  CreditCard,
  ClipboardList,
  BookOpen,
  ArrowRightLeft,
  Bell,
  Star,
} from "lucide-react";
import { TOOL_LABELS } from "./constants";

const TOOL_ICONS: Record<string, React.ElementType> = {
  product_search: Search,
  product_detail: Package,
  check_availability: ShoppingCart,
  recommend_product: Star,
  estimate_shipping: Truck,
  create_payment_link: CreditCard,
  create_order: ClipboardList,
  update_notebook: BookOpen,
  move_stage: ArrowRightLeft,
  notify_owner: Bell,
};

interface AgentToolBadgeProps {
  tool: string;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export function AgentToolBadge({
  tool,
  active = true,
  onClick,
  size = "sm",
}: AgentToolBadgeProps) {
  const Icon = TOOL_ICONS[tool] || Package;
  const label = TOOL_LABELS[tool] || tool;
  const isClickable = !!onClick;

  const sizeClasses =
    size === "sm"
      ? "px-2.5 py-1.5 text-[11px] gap-1.5"
      : "px-3.5 py-2 text-xs gap-2";

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      className={`inline-flex items-center ${sizeClasses} rounded-lg font-medium transition-all duration-200 ${
        active
          ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
          : "border border-gray-200 bg-gray-50 text-gray-400"
      } ${
        isClickable
          ? "cursor-pointer hover:shadow-sm active:scale-[0.97]"
          : "cursor-default"
      }`}
    >
      <Icon className={iconSize} />
      {label}
    </button>
  );
}
