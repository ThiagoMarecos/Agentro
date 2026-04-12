import { Check, Circle } from "lucide-react";
import type { SetupCheck } from "@/lib/api/dashboard";

const LABEL_ES: Record<string, string> = {
  store_profile_completed: "Perfil de tienda completo",
  logo_set: "Logo configurado",
  theme_selected: "Plantilla seleccionada",
  has_categories: "Al menos 1 categoría",
  has_products: "Al menos 1 producto",
  ai_channel_configured: "Canal IA configurado",
  storefront_ready: "Tienda lista",
};

interface SetupProgressCardProps {
  checks: SetupCheck[];
  completed: number;
  total: number;
}

export function SetupProgressCard({ checks, completed, total }: SetupProgressCardProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-xl bg-white border border-gray-200/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-gray-900">Progreso</h2>
        <span className="text-xs text-gray-400 font-medium">
          {completed}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="space-y-2.5">
        {checks.map((check) => (
          <li
            key={check.id}
            className={`flex items-center gap-3 text-sm ${
              check.completed ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {check.completed ? (
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="w-4 h-4 flex-shrink-0 text-gray-300" />
            )}
            <span>{LABEL_ES[check.id] ?? check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
