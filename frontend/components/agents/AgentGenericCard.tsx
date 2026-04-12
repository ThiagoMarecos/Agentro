"use client";

import { Bot, Trash2, Power, Settings } from "lucide-react";

interface AgentGenericCardProps {
  agent: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    config?: string | null;
  };
  onDelete: (id: string, name: string) => void;
  onEdit?: (id: string) => void;
}

export function AgentGenericCard({
  agent,
  onDelete,
  onEdit,
}: AgentGenericCardProps) {
  let model = "gpt-4o";
  try {
    model = JSON.parse(agent.config || "{}").model || "gpt-4o";
  } catch {}

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-5 flex items-start gap-4 hover:shadow-sm transition-all duration-200 group">
      {/* Icon */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
          agent.is_active
            ? "bg-green-50 text-green-600"
            : "bg-gray-100 text-gray-400"
        }`}
      >
        <Bot className="w-5 h-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1">
          <h3 className="font-semibold text-gray-900 text-sm">{agent.name}</h3>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              agent.is_active
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
            }`}
          >
            <Power className="w-2.5 h-2.5" />
            {agent.is_active ? "Activo" : "Inactivo"}
          </span>
        </div>
        {agent.description && (
          <p className="text-gray-400 text-xs leading-relaxed">
            {agent.description}
          </p>
        )}
        <p className="text-[10px] text-gray-400 mt-1.5">Modelo: {model}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onEdit && (
          <button
            onClick={() => onEdit(agent.id)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
            title="Editar"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(agent.id, agent.name)}
          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
