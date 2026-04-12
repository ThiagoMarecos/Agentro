"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Save,
  Loader2,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import type { AIAgent, AIAgentCreate } from "@/lib/api/ai-agents";
import { AgentToolBadge } from "./AgentToolBadge";
import {
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  STAGE_COLORS,
  ALL_TOOLS,
  TOOL_CATEGORIES,
  MODEL_OPTIONS,
  TONE_OPTIONS,
  SALES_STYLE_OPTIONS,
} from "./constants";

function parseTools(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseConfig(raw: string | null | undefined) {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

interface AgentConfigPanelProps {
  agent: AIAgent;
  onSave: (id: string, data: Partial<AIAgentCreate>) => Promise<void>;
  onClose: () => void;
}

export function AgentConfigPanel({
  agent,
  onSave,
  onClose,
}: AgentConfigPanelProps) {
  const config = parseConfig(agent.config);
  const stageName = agent.stage_name || "";
  const colors = STAGE_COLORS[stageName] || {
    border: "border-gray-400",
    bg: "bg-gray-50",
    text: "text-gray-700",
    icon: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  };

  /* ── Local state ───────────────────────────────── */
  const [prompt, setPrompt] = useState(agent.system_prompt || "");
  const [model, setModel] = useState(config.model || "gpt-4o");
  const [temperature, setTemperature] = useState(
    String(config.temperature ?? "0.7")
  );
  const [tone, setTone] = useState(agent.tone || "friendly");
  const [salesStyle, setSalesStyle] = useState(
    agent.sales_style || "consultative"
  );
  const [isActive, setIsActive] = useState(agent.is_active);
  const [tools, setTools] = useState<string[]>(parseTools(agent.enabled_tools));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* ── Sync on agent change ──────────────────────── */
  useEffect(() => {
    const cfg = parseConfig(agent.config);
    setPrompt(agent.system_prompt || "");
    setModel(cfg.model || "gpt-4o");
    setTemperature(String(cfg.temperature ?? "0.7"));
    setTone(agent.tone || "friendly");
    setSalesStyle(agent.sales_style || "consultative");
    setIsActive(agent.is_active);
    setTools(parseTools(agent.enabled_tools));
    setSaved(false);
    setError("");
  }, [agent]);

  /* ── Handlers ──────────────────────────────────── */
  const toggleTool = (tool: string) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await onSave(agent.id, {
        system_prompt: prompt,
        tone,
        sales_style: salesStyle,
        is_active: isActive,
        enabled_tools: JSON.stringify(tools),
        config: JSON.stringify({
          model,
          temperature: parseFloat(temperature) || 0.7,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-200";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-2";

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
      {/* Header */}
      <div className={`border-l-4 ${colors.border}`}>
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors.icon}`}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {agent.display_name || STAGE_LABELS[stageName] || agent.name}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {STAGE_DESCRIPTIONS[stageName] ||
                  agent.description ||
                  "Agente de etapa"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Active toggle */}
            <button
              onClick={() => setIsActive(!isActive)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                isActive
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive ? "bg-green-500" : "bg-red-400"
                }`}
              />
              {isActive ? "Activo" : "Inactivo"}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6 border-t border-gray-100">
        {/* Feedback */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {saved && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              Agente guardado correctamente
            </p>
          </div>
        )}

        {/* System Prompt */}
        <div>
          <label className={labelClass}>System Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className={`${inputClass} font-mono text-xs leading-relaxed`}
            placeholder="Escribe las instrucciones del agente..."
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Define la personalidad, reglas y comportamiento del agente para esta
            etapa.
          </p>
        </div>

        {/* Model & Personality row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Modelo</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Temperatura</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tono</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={inputClass}
            >
              {TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estilo de venta</label>
            <select
              value={salesStyle}
              onChange={(e) => setSalesStyle(e.target.value)}
              className={inputClass}
            >
              {SALES_STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tools by category */}
        <div>
          <label className={labelClass}>
            Herramientas habilitadas ({tools.length} de {ALL_TOOLS.length})
          </label>
          <div className="space-y-4">
            {Object.entries(TOOL_CATEGORIES).map(([catKey, cat]) => (
              <div key={catKey}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cat.tools.map((tool) => (
                    <AgentToolBadge
                      key={tool}
                      tool={tool}
                      size="md"
                      active={tools.includes(tool)}
                      onClick={() => toggleTool(tool)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced section (placeholder for future agentic features) */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
          >
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Configuracion avanzada
          </button>
          {showAdvanced && (
            <div className="mt-4 p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
              <p className="text-xs text-gray-500">
                Las opciones avanzadas (transiciones de etapa custom, condiciones
                de escalacion, integraciones externas, etc.) estaran disponibles
                proximamente cuando se integre el motor agentico completo.
              </p>
              {/*
                INTEGRATION HOOK: Future agentic features go here.
                When the full agentic MD spec is provided, extend this section with:
                - Stage transition rules
                - Escalation conditions
                - Custom tool configurations
                - Webhook integrations
                - A/B testing for prompts
                - Performance metrics per agent
              */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-dashed border-gray-300 text-center">
                  <p className="text-[10px] font-semibold text-gray-400">
                    Reglas de transicion
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">Proximo</p>
                </div>
                <div className="p-3 rounded-lg border border-dashed border-gray-300 text-center">
                  <p className="text-[10px] font-semibold text-gray-400">
                    Condiciones de escalacion
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">Proximo</p>
                </div>
                <div className="p-3 rounded-lg border border-dashed border-gray-300 text-center">
                  <p className="text-[10px] font-semibold text-gray-400">
                    Metricas del agente
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">Proximo</p>
                </div>
                <div className="p-3 rounded-lg border border-dashed border-gray-300 text-center">
                  <p className="text-[10px] font-semibold text-gray-400">
                    A/B testing de prompts
                  </p>
                  <p className="text-[10px] text-gray-300 mt-0.5">Proximo</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Save actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
