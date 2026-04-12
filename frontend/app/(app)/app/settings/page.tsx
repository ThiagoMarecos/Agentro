"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  Image as ImageIcon,
  Globe,
  Mail,
  Search,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useStore } from "@/lib/context/StoreContext";
import { useStoreSettings } from "@/lib/hooks/useStoreSettings";
import { uploadImage } from "@/lib/api/products";
import { deleteStore } from "@/lib/api/stores";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { EmptyState } from "@/components/ui/EmptyState";

type Tab = "general" | "brand" | "regional" | "contact" | "seo" | "danger";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Store },
  { id: "brand", label: "Marca", icon: ImageIcon },
  { id: "regional", label: "Regional", icon: Globe },
  { id: "contact", label: "Contacto", icon: Mail },
  { id: "seo", label: "SEO", icon: Search },
  { id: "danger", label: "Zona de peligro", icon: AlertTriangle },
];

const BUSINESS_TYPES = [
  "Moda y ropa",
  "Electrónica",
  "Hogar y decoración",
  "Alimentos y bebidas",
  "Salud y belleza",
  "Deportes",
  "Juguetes y niños",
  "Mascotas",
  "Joyería y accesorios",
  "Arte y artesanías",
  "Libros y educación",
  "Otro",
];

const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colombia" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Perú" },
  { code: "EC", name: "Ecuador" },
  { code: "UY", name: "Uruguay" },
  { code: "PY", name: "Paraguay" },
  { code: "VE", name: "Venezuela" },
  { code: "BO", name: "Bolivia" },
  { code: "ES", name: "España" },
  { code: "US", name: "Estados Unidos" },
  { code: "BR", name: "Brasil" },
];

const CURRENCIES = [
  { code: "USD", name: "Dólar estadounidense", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "PYG", name: "Guaraní paraguayo", symbol: "₲" },
  { code: "ARS", name: "Peso argentino", symbol: "$" },
  { code: "MXN", name: "Peso mexicano", symbol: "$" },
  { code: "COP", name: "Peso colombiano", symbol: "$" },
  { code: "CLP", name: "Peso chileno", symbol: "$" },
  { code: "PEN", name: "Sol peruano", symbol: "S/" },
  { code: "UYU", name: "Peso uruguayo", symbol: "$" },
  { code: "BRL", name: "Real brasileño", symbol: "R$" },
  { code: "GBP", name: "Libra esterlina", symbol: "£" },
  { code: "VES", name: "Bolívar venezolano", symbol: "Bs." },
  { code: "BOB", name: "Boliviano", symbol: "Bs." },
];

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "fr", label: "Français" },
];

const TIMEZONES = [
  { value: "America/Buenos_Aires", label: "Buenos Aires (GMT-3)" },
  { value: "America/Mexico_City", label: "Ciudad de México (GMT-6)" },
  { value: "America/Bogota", label: "Bogotá (GMT-5)" },
  { value: "America/Santiago", label: "Santiago (GMT-4)" },
  { value: "America/Lima", label: "Lima (GMT-5)" },
  { value: "America/New_York", label: "Nueva York (GMT-5)" },
  { value: "America/Los_Angeles", label: "Los Ángeles (GMT-8)" },
  { value: "America/Sao_Paulo", label: "São Paulo (GMT-3)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
  { value: "Europe/London", label: "Londres (GMT+0)" },
  { value: "UTC", label: "UTC" },
];

const inputCls = "w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white";
const selectCls = inputCls;
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

export default function SettingsPage() {
  const router = useRouter();
  const { currentStore, refresh: refreshStores } = useStore();
  const { settings, update, isLoading, error, refresh } = useStoreSettings(
    currentStore?.id ?? null
  );
  const [tab, setTab] = useState<Tab>("general");
  const [form, setForm] = useState({
    name: "", slug: "", description: "", business_type: "",
    country: "", currency: "USD", language: "es", timezone: "",
    support_email: "", support_phone: "",
    logo_url: "", favicon_url: "", og_image_url: "",
    meta_title: "", meta_description: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name ?? "",
        slug: settings.slug ?? "",
        description: settings.description ?? "",
        business_type: settings.business_type ?? settings.industry ?? "",
        country: settings.country ?? "",
        currency: settings.currency ?? "USD",
        language: settings.language ?? "es",
        timezone: settings.timezone ?? "",
        support_email: settings.support_email ?? "",
        support_phone: settings.support_phone ?? "",
        logo_url: settings.logo_url ?? "",
        favicon_url: settings.favicon_url ?? "",
        og_image_url: settings.og_image_url ?? "",
        meta_title: settings.meta_title ?? "",
        meta_description: settings.meta_description ?? "",
      });
    }
  }, [settings]);

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setSaveError(null);
  };

  const setField = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!currentStore) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await update({
        name: form.name || undefined,
        slug: form.slug || undefined,
        description: form.description || undefined,
        business_type: form.business_type || undefined,
        country: form.country || undefined,
        currency: form.currency,
        language: form.language,
        timezone: form.timezone || undefined,
        support_email: form.support_email || undefined,
        support_phone: form.support_phone || undefined,
        logo_url: form.logo_url || undefined,
        favicon_url: form.favicon_url || undefined,
        og_image_url: form.og_image_url || undefined,
        meta_title: form.meta_title || undefined,
        meta_description: form.meta_description || undefined,
      });
      setSaveSuccess(true);
      refreshStores();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = useCallback(async (file: File) => {
    if (!currentStore) throw new Error("No hay tienda");
    return uploadImage(currentStore.id, file);
  }, [currentStore]);

  if (!currentStore) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-6">Configuración</h1>
        <EmptyState title="Seleccioná una tienda" description="No hay tienda seleccionada." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-400 mt-1">Configuración de {currentStore.name}</p>
        </div>
        {tab !== "danger" && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
          <button onClick={refresh} className="ml-4 underline">Reintentar</button>
        </div>
      )}

      {saveSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Cambios guardados correctamente
        </div>
      )}
      {saveError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {saveError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Tabs */}
        <nav className="sm:w-52 flex-shrink-0">
          <div className="flex sm:flex-col gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : t.id === "danger"
                      ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-indigo-500" : "text-gray-400"}`} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === "general" && (
            <Section title="General" desc="Información básica de tu tienda">
              <Field label="Nombre de la tienda">
                <input value={form.name} onChange={set("name")} placeholder="Mi Tienda" className={inputCls} />
              </Field>
              <Field label="Slug (URL)">
                <input value={form.slug} onChange={set("slug")} placeholder="mi-tienda" className={inputCls} />
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Tu tienda estará en <span className="font-mono text-gray-600">/store/{form.slug || "..."}</span>
                </p>
              </Field>
              <Field label="Tipo de negocio">
                <select value={form.business_type} onChange={set("business_type")} className={selectCls}>
                  <option value="">Seleccionar...</option>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </Field>
              <Field label="Descripción">
                <textarea
                  value={form.description}
                  onChange={set("description")}
                  placeholder="Breve descripción de tu tienda"
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
                <p className="text-xs text-gray-400 mt-1">{form.description.length}/300 caracteres</p>
              </Field>
            </Section>
          )}

          {tab === "brand" && (
            <Section title="Marca" desc="Logo e identidad visual de tu tienda">
              <ImageUploader
                label="Logo"
                value={form.logo_url || null}
                onChange={(url) => setField("logo_url", url || "")}
                onUpload={handleUpload}
                previewSize="lg"
                hint="PNG o JPG. Recomendado: 512x512px."
              />
              <div className="border-t border-gray-100 pt-6">
                <ImageUploader
                  label="Favicon"
                  value={form.favicon_url || null}
                  onChange={(url) => setField("favicon_url", url || "")}
                  onUpload={handleUpload}
                  previewSize="sm"
                  hint="ICO, PNG o SVG. Recomendado: 32x32px."
                />
              </div>
              <div className="border-t border-gray-100 pt-6">
                <ImageUploader
                  label="Imagen para redes sociales (Open Graph)"
                  value={form.og_image_url || null}
                  onChange={(url) => setField("og_image_url", url || "")}
                  onUpload={handleUpload}
                  previewSize="lg"
                  hint="PNG o JPG. Recomendado: 1200x630px."
                />
              </div>
            </Section>
          )}

          {tab === "regional" && (
            <Section title="Regional" desc="Configuración de moneda, idioma y zona horaria">
              <Field label="País">
                <select value={form.country} onChange={set("country")} className={selectCls}>
                  <option value="">Seleccionar país...</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Moneda">
                <select value={form.currency} onChange={set("currency")} className={selectCls}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.symbol} {c.code} - {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Idioma">
                <select value={form.language} onChange={set("language")} className={selectCls}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Zona horaria">
                <select value={form.timezone} onChange={set("timezone")} className={selectCls}>
                  <option value="">Seleccionar...</option>
                  {TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            </Section>
          )}

          {tab === "contact" && (
            <Section title="Contacto" desc="Datos de contacto de tu tienda">
              <Field label="Email de soporte">
                <input
                  type="email"
                  value={form.support_email}
                  onChange={set("support_email")}
                  placeholder="soporte@mitienda.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Teléfono de soporte">
                <input
                  value={form.support_phone}
                  onChange={set("support_phone")}
                  placeholder="+54 11 1234-5678"
                  className={inputCls}
                />
              </Field>
            </Section>
          )}

          {tab === "seo" && (
            <Section title="SEO" desc="Optimización para motores de búsqueda">
              <Field label="Meta título">
                <input
                  value={form.meta_title}
                  onChange={set("meta_title")}
                  placeholder="Mi Tienda - Lo mejor en..."
                  maxLength={70}
                  className={inputCls}
                />
                <p className={`text-xs mt-1 ${form.meta_title.length > 60 ? "text-amber-500" : "text-gray-400"}`}>
                  {form.meta_title.length}/70 caracteres {form.meta_title.length > 60 && "(recomendado: máximo 60)"}
                </p>
              </Field>
              <Field label="Meta descripción">
                <textarea
                  value={form.meta_description}
                  onChange={set("meta_description")}
                  placeholder="Descripción para buscadores"
                  rows={3}
                  maxLength={160}
                  className={`${inputCls} resize-none`}
                />
                <p className={`text-xs mt-1 ${form.meta_description.length > 155 ? "text-amber-500" : "text-gray-400"}`}>
                  {form.meta_description.length}/160 caracteres {form.meta_description.length > 155 && "(recomendado: máximo 155)"}
                </p>
              </Field>

              {/* Google preview */}
              <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Vista previa en Google</p>
                <div className="space-y-1">
                  <p className="text-lg text-blue-700 font-medium truncate leading-tight">
                    {form.meta_title || form.name || "Título de tu tienda"}
                  </p>
                  <p className="text-sm text-green-700 truncate">
                    tudominio.com/store/{form.slug || "mi-tienda"}
                  </p>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {form.meta_description || form.description || "Descripción de tu tienda para motores de búsqueda..."}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {tab === "danger" && (
            <DangerZone
              storeId={currentStore.id}
              storeName={currentStore.name}
              isActive={settings?.is_active ?? true}
              onToggleActive={async (active) => {
                await update({ is_active: active });
                refreshStores();
              }}
              onDelete={async () => {
                await deleteStore(currentStore.id);
                refreshStores();
                router.push("/app");
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-400">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function DangerZone({
  storeId,
  storeName,
  isActive,
  onToggleActive,
  onDelete,
}: {
  storeId: string;
  storeName: string;
  isActive: boolean;
  onToggleActive: (active: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await onToggleActive(!isActive);
    } catch {
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (confirmName !== storeName) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-amber-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Suspender tienda</h2>
        <p className="text-sm text-gray-500 mb-4">
          {isActive
            ? "Tu tienda está activa y visible para los clientes. Podés suspenderla temporalmente."
            : "Tu tienda está suspendida. Los clientes no pueden acceder. Podés reactivarla."}
        </p>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 ${
            isActive
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
              : "bg-green-100 text-green-700 hover:bg-green-200"
          }`}
        >
          {toggling && <Loader2 className="w-4 h-4 animate-spin" />}
          {isActive ? "Suspender tienda" : "Reactivar tienda"}
        </button>
      </div>

      <div className="bg-white rounded-xl border-2 border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-1">Eliminar tienda</h2>
        <p className="text-sm text-gray-500 mb-4">
          Esto eliminará permanentemente <strong>{storeName}</strong> y todos sus datos
          (productos, pedidos, configuración, clientes). Esta acción no se puede deshacer.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition"
          >
            <Trash2 className="w-4 h-4" /> Quiero eliminar esta tienda
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Escribí <strong>{storeName}</strong> para confirmar:
            </p>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={storeName}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
            />
            {error && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">No se puede eliminar</p>
                  <p className="text-sm text-amber-700">{error}</p>
                  <a href="/app/orders" className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 underline">
                    Ir a pedidos →
                  </a>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmName("");
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmName !== storeName || deleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar permanentemente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
