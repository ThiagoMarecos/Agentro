import {
  Package,
  FolderTree,
  Store,
  Palette,
  Settings,
  Bot,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

const ACTION_ICONS: Record<string, LucideIcon> = {
  "product.create": Package,
  "product.update": Package,
  "product.delete": Package,
  "category.create": FolderTree,
  "category.update": FolderTree,
  "category.delete": FolderTree,
  "store.create": Store,
  "theme.changed": Palette,
  "settings.update": Settings,
  "ai_agent.create": Bot,
  "conversation.create": MessageSquare,
};

function formatAction(action: string): string {
  const map: Record<string, string> = {
    "product.create": "Producto creado",
    "product.update": "Producto actualizado",
    "product.delete": "Producto eliminado",
    "category.create": "Categoría creada",
    "category.update": "Categoría actualizada",
    "category.delete": "Categoría eliminada",
    "store.create": "Tienda creada",
    "theme.changed": "Tema actualizado",
    "settings.update": "Configuración actualizada",
    "ai_agent.create": "Agente IA creado",
    "conversation.create": "Conversación iniciada",
  };
  return map[action] || action.replace(/\./g, " ");
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days < 7) return `Hace ${days} días`;
  return date.toLocaleDateString();
}

interface ActivityItemProps {
  action: string;
  details?: Record<string, unknown> | null;
  created_at: string | null;
  user_email?: string | null;
}

export function ActivityItem({
  action,
  details,
  created_at,
  user_email,
}: ActivityItemProps) {
  const Icon = ACTION_ICONS[action] || Settings;
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 p-2 rounded-lg bg-gray-50 text-gray-400">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{formatAction(action)}</p>
        {details && typeof details === "object" && "name" in details && details.name ? (
          <p className="text-xs text-gray-400 truncate">{String(details.name)}</p>
        ) : null}
        <p className="text-xs text-gray-400 mt-0.5">
          {formatTime(created_at)}
          {user_email && ` · ${user_email}`}
        </p>
      </div>
    </div>
  );
}
