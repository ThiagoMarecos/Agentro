"use client";

import { Bot, ChevronRight } from "lucide-react";
import { STAGES, STAGE_LABELS, STAGE_DESCRIPTIONS, STAGE_COLORS } from "./constants";
import type { AIAgent } from "@/lib/api/ai-agents";

interface AgentPipelineViewProps {
  agents: AIAgent[];
  selectedStage: string | null;
  onSelectStage: (stage: string) => void;
}

export function AgentPipelineView({
  agents,
  selectedStage,
  onSelectStage,
}: AgentPipelineViewProps) {
  const agentByStage = new Map(
    agents.map((a) => [a.stage_name, a])
  );

  return (
    <div className="space-y-2">
      {/* Pipeline header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          {STAGES.map((stage, i) => {
            const colors = STAGE_COLORS[stage];
            const hasAgent = agentByStage.has(stage);
            const isSelected = selectedStage === stage;

            return (
              <div key={stage} className="flex items-center">
                <button
                  onClick={() => onSelectStage(stage)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-200 ${
                    isSelected
                      ? `${colors.icon} ring-2 ring-offset-1 ring-current scale-110`
                      : hasAgent
                      ? `${colors.icon} hover:scale-105`
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                  title={STAGE_LABELS[stage]}
                >
                  {i + 1}
                </button>
                {i < STAGES.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-gray-300 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, i) => {
          const colors = STAGE_COLORS[stage];
          const agent = agentByStage.get(stage);
          const isSelected = selectedStage === stage;

          return (
            <button
              key={stage}
              onClick={() => onSelectStage(stage)}
              className={`text-left p-5 rounded-xl border-l-4 transition-all duration-200 ${
                colors.border
              } ${
                isSelected
                  ? "bg-white shadow-md border border-gray-200/60 ring-1 ring-indigo-100"
                  : "bg-white border border-gray-200/60 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.icon}`}
                  >
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {STAGE_LABELS[stage]}
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                      {STAGE_DESCRIPTIONS[stage]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Agent status */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                {agent ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          agent.is_active ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <span className="text-[11px] text-gray-500">
                        {agent.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {(() => {
                        try {
                          const tools = JSON.parse(agent.enabled_tools || "[]");
                          return `${tools.length} tools`;
                        } catch {
                          return "0 tools";
                        }
                      })()}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-gray-400 italic">
                    Sin agente configurado
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
