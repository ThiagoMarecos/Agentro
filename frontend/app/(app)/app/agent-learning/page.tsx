"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import { getAgents, type AIAgent } from "@/lib/api/ai-agents";
import {
  listLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  toggleLearningMode,
  type AgentLesson,
} from "@/lib/api/agent-lessons";
import {
  GraduationCap,
  Plus,
  X,
  Loader2,
  Edit2,
  Trash2,
  Power,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all duration-200 text-sm";
const labelClass = "block text-xs font-semibold text-gray-500 mb-2";

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  tone: { label: "Tono", color: "bg-purple-100 text-purple-700" },
  accuracy: { label: "Precisión", color: "bg-emerald-100 text-emerald-700" },
  flow: { label: "Flujo", color: "bg-indigo-100 text-indigo-700" },
  product_info: { label: "Producto", color: "bg-amber-100 text-amber-700" },
  escalation: { label: "Escalación", color: "bg-rose-100 text-rose-700" },
};

interface LessonFormState {
  title: string;
  lesson_text: string;
  bad_response_example: string;
  correct_response: string;
  category: string;
  priority: number;
  is_active: boolean;
}

const EMPTY_FORM: LessonFormState = {
  title: "",
  lesson_text: "",
  bad_response_example: "",
  correct_response: "",
  category: "",
  priority: 5,
  is_active: true,
};

export default function AgentLearningPage() {
  const { currentStore } = useStore();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [lessons, setLessons] = useState<AgentLesson[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LessonFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  /* ── Fetchers ──────────────────────────────────── */

  const fetchAgents = async () => {
    if (!currentStore) return;
    const all = await getAgents(currentStore.id);
    setAgents(all);
    if (!selectedAgentId && all.length > 0) {
      setSelectedAgentId(all[0].id);
    }
  };

  const fetchLessons = async (agentId: string) => {
    if (!currentStore || !agentId) return;
    setLoading(true);
    try {
      const list = await listLessons(currentStore.id, { agentId });
      setLessons(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [currentStore]);

  useEffect(() => {
    if (selectedAgentId) fetchLessons(selectedAgentId);
  }, [selectedAgentId, currentStore]);

  /* ── Handlers ──────────────────────────────────── */

  const handleToggleLearningMode = async () => {
    if (!currentStore || !selectedAgentId) return;
    try {
      const res = await toggleLearningMode(currentStore.id, selectedAgentId);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgentId
            ? { ...a, learning_mode_enabled: res.learning_mode_enabled }
            : a
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cambiar modo aprendizaje");
    }
  };

  const handleStartCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const handleStartEdit = (lesson: AgentLesson) => {
    setEditingId(lesson.id);
    setForm({
      title: lesson.title,
      lesson_text: lesson.lesson_text,
      bad_response_example: lesson.bad_response_example || "",
      correct_response: lesson.correct_response || "",
      category: lesson.category || "",
      priority: lesson.priority || 5,
      is_active: lesson.is_active,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !selectedAgentId) return;
    if (!form.title.trim() || !form.lesson_text.trim()) {
      setFormError("Título y contenido son obligatorios");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await updateLesson(currentStore.id, editingId, {
          title: form.title.trim(),
          lesson_text: form.lesson_text.trim(),
          bad_response_example: form.bad_response_example.trim() || undefined,
          correct_response: form.correct_response.trim() || undefined,
          category: form.category || undefined,
          priority: form.priority,
          is_active: form.is_active,
        });
      } else {
        await createLesson(currentStore.id, {
          agent_id: selectedAgentId,
          title: form.title.trim(),
          lesson_text: form.lesson_text.trim(),
          bad_response_example: form.bad_response_example.trim() || undefined,
          correct_response: form.correct_response.trim() || undefined,
          category: form.category || undefined,
          priority: form.priority,
          is_active: form.is_active,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchLessons(selectedAgentId);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (lesson: AgentLesson) => {
    if (!currentStore) return;
    try {
      await updateLesson(currentStore.id, lesson.id, {
        is_active: !lesson.is_active,
      });
      fetchLessons(selectedAgentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  };

  const handleDelete = async (lesson: AgentLesson) => {
    if (!currentStore) return;
    if (!confirm(`¿Eliminar la lección "${lesson.title}"?`)) return;
    try {
      await deleteLesson(currentStore.id, lesson.id);
      fetchLessons(selectedAgentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    }
  };

  /* ── Guards ────────────────────────────────────── */

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">Selecciona una tienda</p>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-200/60 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            No tenés agentes creados
          </p>
          <p className="text-xs text-gray-500">
            Creá un agente desde la sección "Agentes IA" para empezar a usar el modo
            aprendizaje.
          </p>
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────── */

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-violet-50">
            <GraduationCap className="w-7 h-7 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modo Aprendizaje</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Enseñale al agente cómo querés que responda. Las lecciones se inyectan
              al prompt como instrucciones de máxima prioridad cuando el modo está
              activo.
            </p>
          </div>
        </div>
      </div>

      {/* Agent picker + learning mode toggle */}
      <div className="bg-white rounded-2xl border border-gray-200/60 p-5">
        <div className="grid md:grid-cols-2 gap-5 items-end">
          <div>
            <label className={labelClass}>Agente</label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className={inputClass}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.name}
                  {a.agent_type === "stage" ? ` · ${a.stage_name}` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedAgent && (
            <div>
              <label className={labelClass}>Estado del modo aprendizaje</label>
              <button
                onClick={handleToggleLearningMode}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  selectedAgent.learning_mode_enabled
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Power className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {selectedAgent.learning_mode_enabled
                      ? "Activo · las lecciones se inyectan al prompt"
                      : "Inactivo · click para activar"}
                  </span>
                </div>
                <span
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    selectedAgent.learning_mode_enabled
                      ? "bg-emerald-500"
                      : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      selectedAgent.learning_mode_enabled
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          )}
        </div>

        {selectedAgent?.learning_mode_enabled && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-700">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Modo aprendizaje activo. Las {lessons.filter((l) => l.is_active).length}{" "}
              lecciones activas se incluyen como prioridad máxima en cada conversación.
            </p>
          </div>
        )}
      </div>

      {/* Lessons list + create */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lecciones</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {lessons.length} {lessons.length === 1 ? "lección" : "lecciones"}
            </p>
          </div>
          {!showForm && (
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition"
            >
              <Plus className="w-4 h-4" /> Nueva lección
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200/60 p-6 mb-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">
                {editingId ? "Editar lección" : "Nueva lección"}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
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

            <form onSubmit={handleSubmitForm} className="space-y-5">
              <div>
                <label className={labelClass}>
                  Título <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                  placeholder="Ej: No prometas envíos en menos de 3 días"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>
                  Instrucción <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={form.lesson_text}
                  onChange={(e) => setForm({ ...form, lesson_text: e.target.value })}
                  rows={3}
                  className={inputClass}
                  placeholder="Ej: Nunca prometas tiempos de envío menores a 3 días hábiles. Si el cliente insiste, ofrecé contactar al equipo logístico."
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Ejemplo de mala respuesta (opcional)
                  </label>
                  <textarea
                    value={form.bad_response_example}
                    onChange={(e) =>
                      setForm({ ...form, bad_response_example: e.target.value })
                    }
                    rows={3}
                    className={inputClass}
                    placeholder="Ej: 'Sí, te llega mañana sin problema'"
                  />
                </div>
                <div>
                  <label className={labelClass}>Respuesta correcta (opcional)</label>
                  <textarea
                    value={form.correct_response}
                    onChange={(e) =>
                      setForm({ ...form, correct_response: e.target.value })
                    }
                    rows={3}
                    className={inputClass}
                    placeholder="Ej: 'El envío estándar es de 3 a 5 días hábiles. ¿Te sirve?'"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Sin categoría —</option>
                    <option value="tone">Tono</option>
                    <option value="accuracy">Precisión</option>
                    <option value="flow">Flujo</option>
                    <option value="product_info">Información de producto</option>
                    <option value="escalation">Escalación</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    Prioridad (1=máx, 10=mín)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: parseInt(e.target.value) || 5 })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Estado</label>
                  <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm({ ...form, is_active: e.target.checked })
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-700">
                      {form.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {saving
                    ? "Guardando..."
                    : editingId
                    ? "Guardar cambios"
                    : "Crear lección"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lessons grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : lessons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/60 p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              Aún no hay lecciones
            </p>
            <p className="text-xs text-gray-500 mb-5">
              Creá la primera lección para corregir el comportamiento del agente
            </p>
            <button
              onClick={handleStartCreate}
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 transition"
            >
              <Plus className="w-4 h-4" /> Nueva lección
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => {
              const cat = lesson.category
                ? CATEGORY_LABELS[lesson.category] || {
                    label: lesson.category,
                    color: "bg-gray-100 text-gray-600",
                  }
                : null;
              return (
                <div
                  key={lesson.id}
                  className={`bg-white rounded-2xl border p-5 transition ${
                    lesson.is_active
                      ? "border-gray-200/60"
                      : "border-gray-200/60 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 text-sm">
                          {lesson.title}
                        </h3>
                        {cat && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${cat.color}`}
                          >
                            {cat.label}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600">
                          P{lesson.priority || 5}
                        </span>
                        {lesson.is_active ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Activa
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-500">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {lesson.lesson_text}
                      </p>
                      {(lesson.bad_response_example || lesson.correct_response) && (
                        <div className="mt-3 grid md:grid-cols-2 gap-2">
                          {lesson.bad_response_example && (
                            <div className="p-3 rounded-lg bg-rose-50/50 border border-rose-100">
                              <p className="text-[10px] font-bold text-rose-600 mb-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> MAL
                              </p>
                              <p className="text-xs text-gray-700">
                                {lesson.bad_response_example}
                              </p>
                            </div>
                          )}
                          {lesson.correct_response && (
                            <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                              <p className="text-[10px] font-bold text-emerald-600 mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> BIEN
                              </p>
                              <p className="text-xs text-gray-700">
                                {lesson.correct_response}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(lesson)}
                        className={`p-2 rounded-lg hover:bg-gray-50 transition ${
                          lesson.is_active ? "text-emerald-600" : "text-gray-400"
                        }`}
                        title={lesson.is_active ? "Desactivar" : "Activar"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStartEdit(lesson)}
                        className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(lesson)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
