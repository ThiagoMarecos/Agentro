"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import {
  getAgents,
  seedStageAgents,
  updateAgent,
  createAgent,
  deleteAgent,
  deleteAllStageAgents,
  deleteAllAgents,
  toggleAllAgents,
  type AIAgent,
  type AIAgentCreate,
} from "@/lib/api/ai-agents";
import {
  AgentPipelineView,
  AgentConfigPanel,
  AgentGenericCard,
  STAGE_LABELS,
  MODEL_OPTIONS,
} from "@/components/agents";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Bot,
  Plus,
  X,
  Loader2,
  Zap,
  Workflow,
  Layers,
  Info,
  Trash2,
  RotateCcw,
  Power,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";

/* ── Input styles ────────────────────────────────── */

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 text-sm";
const labelClass = "block text-xs font-semibold text-gray-500 mb-2";

/* ════════════════════════════════════════════════════ */
/*              AI AGENTS PAGE                         */
/* ════════════════════════════════════════════════════ */

export default function AIAgentsPage() {
  const { currentStore } = useStore();

  /* ── Data state ────────────────────────────────── */
  const [stageAgents, setStageAgents] = useState<AIAgent[]>([]);
  const [genericAgents, setGenericAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  /* ── Pipeline selection ────────────────────────── */
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  /* ── Bulk actions ───────────────────────────────── */
  const [showActions, setShowActions] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
    destructive?: boolean;
  } | null>(null);

  /* ── Generic agent form ────────────────────────── */
  const [showGenericForm, setShowGenericForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formModel, setFormModel] = useState("gpt-4o");
  const [formTemperature, setFormTemperature] = useState("0.7");
  const [formActive, setFormActive] = useState(true);

  /* ── Fetch agents ──────────────────────────────── */

  const fetchAll = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const all = await getAgents(currentStore.id);
      setStageAgents(all.filter((a) => a.agent_type === "stage"));
      setGenericAgents(all.filter((a) => a.agent_type !== "stage"));
    } catch {
      setStageAgents([]);
      setGenericAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [currentStore]);

  /* ── Handlers ──────────────────────────────────── */

  const handleSeed = async () => {
    if (!currentStore) return;
    setSeeding(true);
    try {
      await seedStageAgents(currentStore.id);
      await fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al inicializar agentes");
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteAllStage = () => {
    setConfirmModal({
      title: "Eliminar agentes de etapa",
      description: `Esto eliminara los ${stageAgents.length} agentes del pipeline de ventas. Podras reinicializarlos despues.`,
      destructive: true,
      action: async () => {
        if (!currentStore) return;
        setBulkLoading(true);
        try {
          await deleteAllStageAgents(currentStore.id);
          setSelectedStage(null);
          await fetchAll();
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleDeleteAll = () => {
    const total = stageAgents.length + genericAgents.length;
    setConfirmModal({
      title: "Eliminar TODOS los agentes",
      description: `Esto eliminara los ${total} agentes (etapa + genericos). Esta accion no se puede deshacer.`,
      destructive: true,
      action: async () => {
        if (!currentStore) return;
        setBulkLoading(true);
        try {
          await deleteAllAgents(currentStore.id);
          setSelectedStage(null);
          await fetchAll();
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleResetPipeline = () => {
    setConfirmModal({
      title: "Resetear pipeline",
      description:
        "Esto eliminara todos los agentes de etapa actuales y los reinicializara con la configuracion por defecto.",
      destructive: false,
      action: async () => {
        if (!currentStore) return;
        setBulkLoading(true);
        try {
          await deleteAllStageAgents(currentStore.id);
          await seedStageAgents(currentStore.id);
          setSelectedStage(null);
          await fetchAll();
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleToggleAll = async () => {
    if (!currentStore) return;
    setBulkLoading(true);
    try {
      await toggleAllAgents(currentStore.id);
      await fetchAll();
    } finally {
      setBulkLoading(false);
      setShowActions(false);
    }
  };

  const handleSaveStageAgent = async (
    id: string,
    data: Partial<AIAgentCreate>
  ) => {
    if (!currentStore) throw new Error("No hay tienda seleccionada");
    await updateAgent(currentStore.id, id, data);
    await fetchAll();
  };

  const handleSelectStage = (stage: string) => {
    setSelectedStage((prev) => (prev === stage ? null : stage));
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrompt("");
    setFormModel("gpt-4o");
    setFormTemperature("0.7");
    setFormActive(true);
    setFormError("");
  };

  const handleCreateGeneric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !formName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await createAgent(currentStore.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        system_prompt: formPrompt.trim() || undefined,
        config: JSON.stringify({
          model: formModel,
          temperature: parseFloat(formTemperature) || 0.7,
        }),
        is_active: formActive,
      });
      resetForm();
      setShowGenericForm(false);
      fetchAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear agente");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGeneric = async (id: string, name: string) => {
    if (!currentStore) return;
    if (!confirm(`Eliminar el agente "${name}"?`)) return;
    try {
      await deleteAgent(currentStore.id, id);
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  /* ── Selected agent for config panel ───────────── */
  const selectedAgent = selectedStage
    ? stageAgents.find((a) => a.stage_name === selectedStage) || null
    : null;

  /* ── Guards ────────────────────────────────────── */

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Selecciona una tienda</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-gray-400">Cargando agentes...</p>
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────── */

  return (
    <div className="space-y-10 max-w-6xl">
      {/* ══ Page header ══════════════════════════════ */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-50">
              <Workflow className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Centro de Agentes IA
              </h1>
              <p className="text-sm text-gray-500 mt-1 max-w-lg">
                Configura los agentes especializados para cada etapa del pipeline
                de ventas. Cada agente tiene su propio prompt, modelo y
                herramientas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {stageAgents.length === 0 && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-sm"
              >
                {seeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {seeding ? "Inicializando..." : "Inicializar Pipeline"}
              </button>
            )}

            {/* Actions dropdown */}
            {(stageAgents.length > 0 || genericAgents.length > 0) && (
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition-all duration-200"
                  title="Acciones"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {showActions && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowActions(false)}
                    />
                    <div className="absolute right-0 top-12 w-64 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-2 overflow-hidden">
                      {stageAgents.length > 0 && (
                        <>
                          <button
                            onClick={() => {
                              setShowActions(false);
                              handleResetPipeline();
                            }}
                            disabled={bulkLoading}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                          >
                            <RotateCcw className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium">Resetear pipeline</p>
                              <p className="text-[10px] text-gray-400">
                                Vuelve a la config por defecto
                              </p>
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              setShowActions(false);
                              handleToggleAll();
                            }}
                            disabled={bulkLoading}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                          >
                            <Power className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium">
                                {stageAgents.some((a) => a.is_active)
                                  ? "Desactivar todos"
                                  : "Activar todos"}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                Toggle masivo de agentes
                              </p>
                            </div>
                          </button>
                        </>
                      )}

                      <div className="border-t border-gray-100 my-1" />

                      {stageAgents.length > 0 && (
                        <button
                          onClick={() => {
                            setShowActions(false);
                            handleDeleteAllStage();
                          }}
                          disabled={bulkLoading}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition text-left"
                        >
                          <Trash2 className="w-4 h-4" />
                          <div>
                            <p className="font-medium">
                              Eliminar agentes de etapa
                            </p>
                            <p className="text-[10px] text-red-400">
                              Elimina los {stageAgents.length} del pipeline
                            </p>
                          </div>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowActions(false);
                          handleDeleteAll();
                        }}
                        disabled={bulkLoading}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition text-left"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <div>
                          <p className="font-medium">Eliminar TODOS</p>
                          <p className="text-[10px] text-red-400">
                            Etapa + genericos (
                            {stageAgents.length + genericAgents.length})
                          </p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Stage Agents Section ═════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-indigo-50">
            <Bot className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Pipeline de Ventas
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {stageAgents.length} agentes de etapa configurados &middot;
              Selecciona una etapa para editar su agente
            </p>
          </div>
        </div>

        {stageAgents.length === 0 ? (
          <EmptyState
            title="Pipeline sin configurar"
            description="Inicializa los 9 agentes especializados para cada etapa del pipeline de ventas. Cada uno tiene su propio prompt, modelo, tono y herramientas."
            action={
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all duration-200 shadow-sm"
              >
                {seeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {seeding
                  ? "Inicializando..."
                  : "Inicializar Agentes de Etapa"}
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {/* Visual pipeline */}
            <AgentPipelineView
              agents={stageAgents}
              selectedStage={selectedStage}
              onSelectStage={handleSelectStage}
            />

            {/* Config panel for selected agent */}
            {selectedAgent && (
              <div className="mt-6">
                <AgentConfigPanel
                  agent={selectedAgent}
                  onSave={handleSaveStageAgent}
                  onClose={() => setSelectedStage(null)}
                />
              </div>
            )}

            {/* Hint when nothing selected */}
            {!selectedAgent && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200/60">
                <Info className="w-5 h-5 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-500">
                  Hace click en cualquier etapa del pipeline para ver y editar
                  la configuracion de su agente.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ══ Generic Agents Section ═══════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gray-100">
              <Layers className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Agente de Ventas
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Tu vendedor IA &middot; El flujo de venta es automático, solo configurá las instrucciones de tu negocio
              </p>
            </div>
          </div>
          {!showGenericForm && (
            <button
              onClick={() => {
                resetForm();
                setShowGenericForm(true);
              }}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition-all duration-200"
            >
              <Plus className="w-4 h-4" /> Crear agente
            </button>
          )}
        </div>

        {/* Create form */}
        {showGenericForm && (
          <div className="bg-white rounded-xl border border-gray-200/60 p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Nuevo agente generico</h3>
              <button
                onClick={() => setShowGenericForm(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateGeneric} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Nombre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={inputClass}
                    placeholder="Ej: Asistente de soporte"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Descripcion</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className={inputClass}
                    placeholder="Breve descripcion del agente"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Instrucciones personalizadas</label>
                <p className="text-[11px] text-gray-400 mb-2 -mt-1">
                  El flujo de venta (saludar, buscar productos, cobrar, etc.) ya es automático.
                  Acá solo escribí las reglas específicas de <strong>tu negocio</strong>.
                </p>
                <textarea
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  rows={5}
                  className={`${inputClass} font-mono text-xs`}
                  placeholder={"Ejemplo:\n- Somos una tienda de ropa urbana en Paraguay\n- Envío gratis en compras mayores a 200.000 Gs\n- Tratá a los clientes de 'vos'\n- Horario de entrega: lunes a viernes 9 a 18hs\n- Si preguntan por tallas, tenemos S, M, L, XL"}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Modelo</label>
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
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
                    value={formTemperature}
                    onChange={(e) => setFormTemperature(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      {formActive ? "Activo" : "Inactivo"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 disabled:opacity-50 transition-all duration-200"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {saving ? "Creando..." : "Crear agente"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenericForm(false)}
                  className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Generic agents list */}
        {genericAgents.length === 0 && !showGenericForm ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Layers className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium mb-1">
              Sin agentes genericos
            </p>
            <p className="text-xs text-gray-400">
              Crea agentes para tareas personalizadas fuera del pipeline de
              ventas
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {genericAgents.map((agent) => (
              <AgentGenericCard
                key={agent.id}
                agent={agent}
                onDelete={handleDeleteGeneric}
              />
            ))}
          </div>
        )}
      </section>

      {/* ══ Confirmation Modal ═════════════════════════ */}
      {confirmModal && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => !bulkLoading && setConfirmModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  confirmModal.destructive
                    ? "bg-red-50 text-red-500"
                    : "bg-indigo-50 text-indigo-600"
                }`}
              >
                {confirmModal.destructive ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <RotateCcw className="w-6 h-6" />
                )}
              </div>

              {/* Content */}
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {confirmModal.title}
                </h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                  {confirmModal.description}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmModal(null)}
                  disabled={bulkLoading}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await confirmModal.action();
                    setConfirmModal(null);
                  }}
                  disabled={bulkLoading}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                    confirmModal.destructive
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {bulkLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
