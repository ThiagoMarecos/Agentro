"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  Shield,
  Globe,
  Bot,
  Smartphone,
  Image,
  Lock,
  RotateCcw,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  getPlatformSettings,
  updatePlatformSettings,
  PlatformSetting,
} from "@/lib/api/platform-settings";

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string; description: string }> = {
  google_oauth: {
    label: "Google OAuth",
    icon: Globe,
    color: "text-blue-600 bg-blue-50",
    description: "Credenciales para inicio de sesión con Google. Obtener en Google Cloud Console > APIs & Services > Credentials.",
  },
  openai: {
    label: "OpenAI (IA)",
    icon: Bot,
    color: "text-emerald-600 bg-emerald-50",
    description: "API Key para el agente de ventas IA. Obtener en platform.openai.com/api-keys.",
  },
  whatsapp: {
    label: "WhatsApp (Evolution API)",
    icon: Smartphone,
    color: "text-green-600 bg-green-50",
    description: "Configuración de Evolution API para integración con WhatsApp Business.",
  },
  pexels: {
    label: "Pexels (Imágenes)",
    icon: Image,
    color: "text-purple-600 bg-purple-50",
    description: "API Key de Pexels para imágenes de stock automáticas.",
  },
  security: {
    label: "Seguridad",
    icon: Lock,
    color: "text-red-600 bg-red-50",
    description: "Configuración de seguridad y encriptación de la plataforma.",
  },
};

function SettingRow({
  setting,
  editValue,
  isEditing,
  revealed,
  onStartEdit,
  onCancelEdit,
  onChange,
  onToggleReveal,
  onSaveSingle,
  isSaving,
}: {
  setting: PlatformSetting;
  editValue: string;
  isEditing: boolean;
  revealed: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChange: (val: string) => void;
  onToggleReveal: () => void;
  onSaveSingle: () => void;
  isSaving: boolean;
}) {
  const displayText = revealed ? setting.real_value : setting.display_value;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-gray-100 last:border-0">
      {/* Label + status */}
      <div className="sm:w-1/3 flex items-center gap-2.5">
        {setting.has_value ? (
          <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 shadow-sm shadow-emerald-500/50" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 shadow-sm shadow-red-500/50" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">{setting.label}</p>
          <p className="text-xs text-gray-400 font-mono">{setting.key}</p>
        </div>
      </div>

      {/* Value */}
      <div className="sm:w-2/3 flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              type="text"
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData.getData("text/plain");
                onChange(pasted);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editValue.trim()) onSaveSingle();
                if (e.key === "Escape") onCancelEdit();
              }}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              placeholder="Pegar valor aquí..."
              className="flex-1 px-3 py-2.5 rounded-lg border border-violet-300 bg-white text-sm font-mono ring-1 ring-violet-200 focus:outline-none focus:border-violet-400 focus:ring-violet-300 transition-all text-gray-900"
            />
            <button
              onClick={onSaveSingle}
              disabled={isSaving || !editValue.trim()}
              className="p-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Guardar este valor"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition"
              title="Cancelar"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div
              className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-mono select-all cursor-text ${
                setting.has_value
                  ? "border-gray-200 bg-gray-50 text-gray-600"
                  : "border-red-200 bg-red-50/50 text-red-400"
              }`}
            >
              {setting.has_value ? displayText : "Sin configurar"}
            </div>

            {setting.has_value && setting.is_secret && (
              <button
                onClick={onToggleReveal}
                className={`p-2 rounded-lg border transition ${
                  revealed
                    ? "border-violet-200 bg-violet-50 text-violet-600"
                    : "border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600"
                }`}
                title={revealed ? "Ocultar" : "Mostrar valor real"}
              >
                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onStartEdit}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    try {
      const data = await getPlatformSettings();
      setSettings(data);
      setEditValues({});
      setEditingKeys(new Set());
      setRevealedKeys(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (key: string) => {
    setEditingKeys((prev) => new Set(prev).add(key));
    setEditValues((prev) => ({ ...prev, [key]: "" }));
  };

  const cancelEdit = (key: string) => {
    setEditingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async (keysToSave?: string[]) => {
    const toUpdate: Record<string, string> = {};
    const keys = keysToSave || Array.from(editingKeys);
    for (const key of keys) {
      const val = editValues[key]?.trim();
      if (val) toUpdate[key] = val;
    }

    if (Object.keys(toUpdate).length === 0) {
      setError("No hay cambios para guardar. Escribí un valor en los campos que editaste.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await updatePlatformSettings(toUpdate);
      setSuccess(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveSingle = (key: string) => {
    handleSave([key]);
  };

  const handleDiscardAll = () => {
    setEditValues({});
    setEditingKeys(new Set());
    setError("");
    setSuccess("");
  };

  // Agrupar por categoría
  const categories = settings.reduce<Record<string, PlatformSetting[]>>((acc, s) => {
    const cat = s.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const editedCount = editingKeys.size;
  const configuredCount = settings.filter((s) => s.has_value).length;
  const totalCount = settings.length;
  const missingCount = totalCount - configuredCount;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-400">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Key className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Keys & Configuración</h1>
            <p className="text-sm text-gray-500">
              Gestiona las claves necesarias para que Nexora funcione al 100%
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            configuredCount === totalCount
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              : "bg-red-50 text-red-700 border border-red-200/60"
          }`}>
            {configuredCount === totalCount ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {configuredCount}/{totalCount} configuradas
          </div>
          {missingCount > 0 && (
            <p className="text-[11px] text-red-500">{missingCount} clave{missingCount > 1 ? "s" : ""} sin configurar</p>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200/60 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Settings by category */}
      {Object.entries(categories).map(([catKey, catSettings]) => {
        const meta = CATEGORY_META[catKey] || {
          label: catKey,
          icon: Key,
          color: "text-gray-600 bg-gray-50",
          description: "",
        };
        const Icon = meta.icon;
        const configuredInCat = catSettings.filter((s) => s.has_value).length;
        const allConfigured = configuredInCat === catSettings.length;

        return (
          <div key={catKey} className={`bg-white rounded-xl border overflow-hidden ${
            allConfigured ? "border-emerald-200/60" : "border-red-200/60"
          }`}>
            {/* Category header */}
            <div className={`px-5 py-4 border-b flex items-center gap-3 ${
              allConfigured ? "border-emerald-100 bg-emerald-50/30" : "border-red-100 bg-red-50/30"
            }`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.color}`}>
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">{meta.label}</h2>
                  {allConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Configurado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" /> {catSettings.length - configuredInCat} pendiente{catSettings.length - configuredInCat > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {meta.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
                )}
              </div>
            </div>

            {/* Settings rows */}
            <div className="px-5">
              {catSettings.map((setting) => (
                <SettingRow
                  key={setting.key}
                  setting={setting}
                  editValue={editValues[setting.key] || ""}
                  isEditing={editingKeys.has(setting.key)}
                  revealed={revealedKeys.has(setting.key)}
                  onStartEdit={() => startEdit(setting.key)}
                  onCancelEdit={() => cancelEdit(setting.key)}
                  onChange={(val) =>
                    setEditValues((prev) => ({ ...prev, [setting.key]: val }))
                  }
                  onToggleReveal={() => toggleReveal(setting.key)}
                  onSaveSingle={() => saveSingle(setting.key)}
                  isSaving={saving}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Actions bar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200/60 px-5 py-4">
        <p className="text-sm text-gray-500">
          {editedCount > 0 ? (
            <span className="text-violet-600 font-medium">
              {editedCount} campo{editedCount > 1 ? "s" : ""} en edición
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Configurada
                <span className="mx-2 text-gray-300">|</span>
                <span className="w-2 h-2 rounded-full bg-red-500" /> Sin configurar
              </span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          {editedCount > 0 && (
            <button
              onClick={handleDiscardAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Descartar
            </button>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving || editedCount === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Security note */}
      <div className="rounded-xl bg-gray-50 border border-gray-200/60 p-4 flex items-start gap-3">
        <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-500 leading-relaxed">
          Las API keys se guardan <strong className="text-gray-700">encriptadas (AES-256)</strong> en la base de datos.
          Solo vos como Super Admin podés verlas y editarlas. Los valores censurados muestran solo los últimos 4 caracteres.
        </p>
      </div>
    </div>
  );
}
