"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useStore } from "@/lib/context/StoreContext";
import {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getRecommendedProviders,
  type PaymentMethod,
  type ProviderInfo,
} from "@/lib/api/payments";
import { ProviderLogo } from "@/components/payments/ProviderLogo";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Power,
  X,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

const KIND_LABELS: Record<string, string> = {
  cash: "Efectivo",
  manual_external: "Cobro externo",
  manual_transfer: "Transferencia",
  digital_redirect: "Cobro online (API)",
};

const KIND_COLORS: Record<string, string> = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  manual_external: "bg-amber-50 text-amber-700 border-amber-200",
  manual_transfer: "bg-blue-50 text-blue-700 border-blue-200",
  digital_redirect: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function PaymentsSettingsPage() {
  const { currentStore } = useStore();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [recommendedKeys, setRecommendedKeys] = useState<string[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  const reload = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const [m, rec] = await Promise.all([
        listPaymentMethods(currentStore.id),
        getRecommendedProviders(currentStore.id),
      ]);
      setMethods(m);
      setProviders(rec.providers);
      setRecommendedKeys(rec.recommended_keys);
      setCountry(rec.country_code);
      setError("");
    } catch (e: any) {
      setError(e.message || "Error cargando métodos de pago");
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onToggle = async (m: PaymentMethod) => {
    if (!currentStore) return;
    try {
      await updatePaymentMethod(currentStore.id, m.id, { is_active: !m.is_active });
      await reload();
    } catch (e: any) {
      alert(e.message || "Error");
    }
  };

  const onDelete = async (m: PaymentMethod) => {
    if (!currentStore) return;
    const provider = providers.find((p) => p.key === m.provider);
    if (!confirm(`¿Eliminar el método "${m.display_name || provider?.name}"?`)) return;
    try {
      await deletePaymentMethod(currentStore.id, m.id);
      await reload();
    } catch (e: any) {
      alert(e.message || "Error");
    }
  };

  if (loading && methods.length === 0) {
    return <div className="py-12 text-center text-gray-400">Cargando…</div>;
  }

  // Providers que el dueño todavía no agregó (para el modal "agregar")
  const usedProviderKeys = new Set(methods.map((m) => m.provider));
  const availableProviders = providers.filter((p) => !usedProviderKeys.has(p.key));

  return (
    <div>
      <Link href="/app/settings" className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 mb-4">
        <ChevronLeft className="w-4 h-4" /> Configuración
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Métodos de pago</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configurá cómo cobrás. Los métodos activos aparecen en el POS y en el storefront.
            {country && <> Recomendados para <strong className="text-gray-600">{country}</strong>.</>}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Agregar método
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {methods.length === 0 ? (
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white shadow-sm grid place-items-center">
            <Sparkles className="w-7 h-7 text-indigo-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-2">Empezá agregando tu primer método</p>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Te recomendamos arrancar con <strong>Efectivo</strong> + <strong>Transferencia bancaria</strong>.
            Después podés sumar Mercado Pago, billeteras o lo que necesites.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Agregar primer método
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => {
            const p = providers.find((x) => x.key === m.provider);
            return (
              <div
                key={m.id}
                className={`bg-white border rounded-xl p-4 flex items-center gap-4 transition ${
                  m.is_active ? "border-gray-200" : "border-gray-200 opacity-60"
                }`}
              >
                {p && <ProviderLogo provider={p} size={48} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setEditing(m)}
                      className="text-sm font-semibold text-gray-900 hover:text-indigo-600 transition"
                    >
                      {m.display_name || p?.name || m.provider}
                    </button>
                    {p && (
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${KIND_COLORS[p.kind]}`}>
                        {KIND_LABELS[p.kind]}
                      </span>
                    )}
                    {m.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> Desactivado
                      </span>
                    )}
                  </div>
                  {p?.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onToggle(m)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title={m.is_active ? "Desactivar" : "Activar"}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(m)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal agregar — key fuerza remontar (resetea state) */}
      {addOpen && currentStore && (
        <AddMethodModal
          key={`add-${methods.length}-${Date.now()}`}
          storeId={currentStore.id}
          providers={availableProviders}
          recommendedKeys={recommendedKeys.filter((k) => !usedProviderKeys.has(k))}
          onClose={() => setAddOpen(false)}
          onCreated={async () => {
            setAddOpen(false);
            await reload();
          }}
        />
      )}

      {/* Modal editar */}
      {editing && currentStore && (
        <EditMethodModal
          key={`edit-${editing.id}`}
          storeId={currentStore.id}
          method={editing}
          provider={providers.find((p) => p.key === editing.provider)!}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}


// ═════════════════════════════════════════════════════
//  Modal: Agregar método
// ═════════════════════════════════════════════════════

function AddMethodModal({
  storeId,
  providers,
  recommendedKeys,
  onClose,
  onCreated,
}: {
  storeId: string;
  providers: ProviderInfo[];
  recommendedKeys: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"choose" | "configure">("choose");
  const [selected, setSelected] = useState<ProviderInfo | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const recommended = providers.filter((p) => recommendedKeys.includes(p.key));
  const others = providers.filter((p) => !recommendedKeys.includes(p.key));

  const onChoose = (p: ProviderInfo) => {
    setSelected(p);
    setConfig({});
    setDisplayName("");
    setError("");
    setStep("configure");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await createPaymentMethod(storeId, {
        provider: selected.key,
        display_name: displayName.trim() || undefined,
        is_active: true,
        sort_order: 0,
        config,
      });
      onCreated();
    } catch (e: any) {
      setError(e.message || "Error creando método");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {step === "choose" ? "Elegí un método de pago" : `Configurar ${selected?.name}`}
            </h3>
            {step === "choose" && (
              <p className="text-xs text-gray-500 mt-0.5">
                Podés agregar más después. Recomendamos empezar con efectivo + transferencia.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "choose" && (
          <div className="p-6 space-y-6">
            {recommended.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Recomendados para tu país
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recommended.map((p) => (
                    <ProviderCard key={p.key} provider={p} onClick={() => onChoose(p)} highlighted />
                  ))}
                </div>
              </section>
            )}

            {others.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {recommended.length > 0 ? "Otros disponibles" : "Disponibles"}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {others.map((p) => (
                    <ProviderCard key={p.key} provider={p} onClick={() => onChoose(p)} />
                  ))}
                </div>
              </section>
            )}

            {providers.length === 0 && (
              <div className="text-center py-8">
                <Check className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700 mb-1">Ya configuraste todos los métodos</p>
                <p className="text-xs text-gray-500">
                  Si querés agregar uno nuevo del catálogo, primero eliminá alguno existente.
                </p>
              </div>
            )}
          </div>
        )}

        {step === "configure" && selected && (
          <form onSubmit={onSubmit} className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <ProviderLogo provider={selected} size={56} />
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{selected.name}</p>
                <p className="text-xs text-gray-500">{selected.description}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Nombre para mostrar (opcional)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={selected.name}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {selected.config_fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-600 mb-1.5">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type={field.type === "secret" ? "password" : "text"}
                  required={field.required}
                  value={config[field.key] || ""}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                />
                {field.type === "secret" && (
                  <p className="text-[11px] text-gray-400 mt-1">🔒 Se guarda encriptado</p>
                )}
              </div>
            ))}

            {selected.config_fields.length === 0 && (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                ✓ Este método no requiere configuración. Solo activalo.
              </div>
            )}

            {error && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Volver
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Activar método
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onClick,
  highlighted,
}: {
  provider: ProviderInfo;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition ${
        highlighted
          ? "border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-400"
          : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <ProviderLogo provider={provider} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{provider.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{provider.description}</p>
        </div>
      </div>
    </button>
  );
}


// ═════════════════════════════════════════════════════
//  Modal: Editar método
// ═════════════════════════════════════════════════════

function EditMethodModal({
  storeId,
  method,
  provider,
  onClose,
  onSaved,
}: {
  storeId: string;
  method: PaymentMethod;
  provider: ProviderInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(method.display_name || "");
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(method.config || {})) {
      out[k] = String(method.config[k] ?? "");
    }
    return out;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const cleanConfig: Record<string, string> = {};
      for (const f of provider.config_fields) {
        const val = config[f.key];
        if (f.type === "secret" && (!val || val.startsWith("****"))) continue;
        if (val !== undefined) cleanConfig[f.key] = val;
      }
      await updatePaymentMethod(storeId, method.id, {
        display_name: displayName.trim() || null,
        config: cleanConfig,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || "Error actualizando");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={provider} size={48} />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
              <p className="text-xs text-gray-500">{provider.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1.5">Nombre para mostrar</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={provider.name}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {provider.config_fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-gray-600 mb-1.5">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type={field.type === "secret" ? "password" : "text"}
                value={config[field.key] || ""}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                placeholder={field.type === "secret" && (config[field.key] || "").startsWith("****") ? "(dejar vacío para no cambiar)" : ""}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
            </div>
          ))}

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
