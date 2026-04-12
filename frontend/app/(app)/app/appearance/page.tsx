"use client";

import { useState, useRef } from "react";
import { useStore } from "@/lib/context/StoreContext";
import { useStoreTheme } from "@/lib/hooks/useStoreTheme";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { SettingsSection } from "@/components/admin/SettingsSection";
import { ThemePreviewCard } from "@/components/admin/ThemePreviewCard";
import { ColorInputRow } from "@/components/admin/ColorInputRow";
import { FormActionsBar } from "@/components/admin/FormActionsBar";
import { SectionEditor } from "@/components/admin/SectionEditor";
import { EmptyState } from "@/components/ui/EmptyState";
import { uploadImage } from "@/lib/api/products";
import { updateStoreSettings } from "@/lib/api/settings";
import { Monitor, Tablet, Smartphone, Download, Upload, Check } from "lucide-react";
import type { ThemeConfig } from "@/lib/api/themes";

const DEFAULT_SECTIONS = [
  { id: "default-hero", type: "hero", enabled: true, order: 0, config: { style: "centered", title: "", subtitle: "", cta_text: "Ver catálogo", bg_image: "" } },
  { id: "default-products", type: "featured_products", enabled: true, order: 1, config: { columns: 4, count: 8, show_price: true } },
  { id: "default-categories", type: "categories", enabled: false, order: 2, config: { layout: "grid" } },
  { id: "default-drops", type: "drops", enabled: true, order: 3, config: {} },
  { id: "default-testimonials", type: "testimonials", enabled: false, order: 4, config: { items: [] } },
  { id: "default-newsletter", type: "newsletter", enabled: false, order: 5, config: { title: "", description: "" } },
  { id: "default-custom-text", type: "custom_text", enabled: false, order: 6, config: { title: "", body: "", image: "" } },
];

const FONTS = ["Outfit", "Inter", "Space Grotesk", "DM Sans", "Plus Jakarta Sans", "Playfair Display"];
const BUTTON_STYLES = [
  { value: "rounded", label: "Redondeado" },
  { value: "square", label: "Cuadrado" },
  { value: "pill", label: "Píldora" },
];
const CARD_STYLES = [
  { value: "elevated", label: "Elevado" },
  { value: "flat", label: "Plano" },
  { value: "outlined", label: "Borde" },
];
const HEADING_WEIGHTS = [
  { value: "normal", label: "Normal" },
  { value: "600", label: "Semibold" },
  { value: "bold", label: "Bold" },
  { value: "800", label: "Extrabold" },
];
const BODY_SIZES = [
  { value: "small", label: "Pequeño" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Grande" },
];
const COLOR_MODES = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "auto", label: "Automático" },
];

type TabId = "design" | "style" | "brand" | "advanced";

const TABS: { id: TabId; label: string }[] = [
  { id: "design", label: "Diseño" },
  { id: "style", label: "Estilo" },
  { id: "brand", label: "Marca" },
  { id: "advanced", label: "Avanzado" },
];

function getButtonRadius(style: string) {
  if (style === "pill") return 9999;
  if (style === "square") return 4;
  return 8;
}

function getCardStyles(style: string, primaryColor: string) {
  const base = {
    backgroundColor: primaryColor + "15",
    border: `1px solid ${primaryColor}25`,
  };
  if (style === "elevated") return { ...base, boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.25)" };
  if (style === "outlined") return { ...base, boxShadow: "none", border: `1px solid ${primaryColor}50` };
  return { ...base, boxShadow: "none" };
}

function LivePreview({
  config,
  templateName,
}: {
  config: ThemeConfig;
  templateName: string;
}) {
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const { colors, button_style, card_style } = config;
  const btnRadius = getButtonRadius(button_style);
  const cardStyle = getCardStyles(card_style, colors.primary);

  const renderHero = () => {
    switch (templateName) {
      case "streetwear":
        return (
          <div className="py-8 flex flex-col items-center justify-center" style={{ backgroundColor: colors.primary }}>
            <div className="w-32 h-2.5 rounded-full mb-2" style={{ backgroundColor: colors.text, opacity: 0.9 }} />
            <div className="w-20 h-1.5 rounded-full mb-3" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
            <div className="px-4 py-1 text-[10px] font-medium" style={{ backgroundColor: colors.accent, color: colors.text, borderRadius: btnRadius }}>
              Comprar
            </div>
          </div>
        );
      case "boutique":
        return (
          <div className="py-5 px-6 flex items-center gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="w-24 h-2 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.6 }} />
              <div className="w-32 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.25 }} />
              <div className="w-16 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.25 }} />
              <div className="mt-1 px-3 py-1 text-[10px] font-medium w-fit" style={{ backgroundColor: colors.primary, color: colors.text, borderRadius: btnRadius }}>
                Ver colección
              </div>
            </div>
            <div className="w-20 h-16 rounded-md" style={{ backgroundColor: colors.secondary + "30", border: `1px solid ${colors.secondary}25` }} />
          </div>
        );
      case "tech":
        return (
          <div
            className="py-7 flex flex-col items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}
          >
            <div className="w-28 h-2.5 rounded-full mb-2" style={{ backgroundColor: colors.text, opacity: 0.9 }} />
            <div className="w-20 h-1 rounded-full mb-3" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
            <div className="px-4 py-1 text-[10px] font-medium" style={{ backgroundColor: colors.text + "20", color: colors.text, borderRadius: btnRadius, border: `1px solid ${colors.text}30` }}>
              Explorar
            </div>
          </div>
        );
      case "artesanal":
        return (
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-6 h-px" style={{ backgroundColor: colors.accent }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
              <div className="w-6 h-px" style={{ backgroundColor: colors.accent }} />
            </div>
            <div className="w-24 h-2 rounded-full mb-1" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-px" style={{ backgroundColor: colors.accent }} />
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
              <div className="w-6 h-px" style={{ backgroundColor: colors.accent }} />
            </div>
          </div>
        );
      default:
        return (
          <div className="py-7 flex flex-col items-center justify-center" style={{ backgroundColor: colors.primary + "20" }}>
            <div className="w-28 h-2 rounded-full mb-2" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
            <div className="w-16 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
          </div>
        );
    }
  };

  const renderProductCard = (accentColor: string, label: string) => (
    <div className="flex-1 min-w-0 flex flex-col" style={cardStyle}>
      <div className="w-full aspect-[4/3] rounded-t-sm" style={{ backgroundColor: accentColor + "20" }} />
      <div className="p-1.5 flex flex-col gap-0.5">
        <div className="w-3/4 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.4 }} />
        <div className="w-1/2 h-1 rounded-full" style={{ backgroundColor: colors.accent, opacity: 0.5 }} />
        <div
          className="mt-1 w-full py-0.5 text-center text-[7px] font-medium"
          style={{ backgroundColor: colors.primary, color: colors.text, borderRadius: btnRadius > 100 ? 9999 : Math.min(btnRadius, 4) }}
        >
          {label}
        </div>
      </div>
    </div>
  );

  const previewMaxWidth = previewMode === "tablet" ? 768 : previewMode === "mobile" ? 375 : undefined;

  const modeButton = (mode: "desktop" | "tablet" | "mobile", Icon: typeof Monitor, label: string) => (
    <button
      type="button"
      onClick={() => setPreviewMode(mode)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        previewMode === mode
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        {modeButton("desktop", Monitor, "Desktop")}
        {modeButton("tablet", Tablet, "Tablet")}
        {modeButton("mobile", Smartphone, "Mobile")}
      </div>

      <div
        className="mx-auto transition-all duration-300 ease-in-out"
        style={{ maxWidth: previewMaxWidth, width: "100%" }}
      >
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
            <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
            <div className="ml-3 flex-1 h-5 rounded-md bg-gray-200/70 flex items-center justify-center">
              <span className="text-[9px] text-gray-400 tracking-wide">mitienda.nexora.com</span>
            </div>
          </div>

          <div style={{ backgroundColor: colors.background }}>
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: colors.text + "10" }}>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded" style={{ backgroundColor: colors.primary }} />
                <div className="w-14 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.5 }} />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
                <div className="w-8 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary + "40" }} />
              </div>
            </div>

            {renderHero()}

            <div className="px-4 py-3">
              <div className="w-20 h-1.5 rounded-full mx-auto mb-3" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
              <div className="flex gap-2">
                {renderProductCard(colors.primary, "Agregar")}
                {renderProductCard(colors.secondary, "Agregar")}
                {renderProductCard(colors.accent, "Agregar")}
                {renderProductCard(colors.primary, "Agregar")}
              </div>
            </div>

            <div className="px-4 py-3 mt-1 flex items-center justify-between" style={{ backgroundColor: colors.primary + "10", borderTop: `1px solid ${colors.text}08` }}>
              <div className="flex flex-col gap-1">
                <div className="w-12 h-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.3 }} />
                <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.15 }} />
              </div>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.15 }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.15 }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.15 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandingUpload({
  label,
  currentUrl,
  storeId,
  fieldName,
}: {
  label: string;
  currentUrl?: string | null;
  storeId: string;
  fieldName: "logo_url" | "favicon_url" | "og_image_url";
}) {
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { refresh } = useStore();

  const displayUrl = localUrl ?? currentUrl;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setShowSuccess(false);
    setError(null);
    try {
      const { url } = await uploadImage(storeId, file);
      setLocalUrl(url);
      try {
        await updateStoreSettings(storeId, { [fieldName]: url });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
        refresh();
      } catch {
        setError("Imagen subida pero no se guardó en la tienda. Intentá de nuevo.");
      }
    } catch (err: any) {
      setError(err?.message || "Error al subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <label className="w-28 text-sm text-gray-500 font-medium shrink-0">{label}</label>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={label}
              className="w-12 h-12 rounded-lg object-cover border border-gray-200"
              onError={() => setError("No se pudo cargar la imagen")}
            />
          ) : (
            <div className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {uploading ? "Subiendo..." : "Cambiar"}
          </button>
          {showSuccess && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
              <Check className="w-4 h-4" />
              Guardado
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const { currentStore, refresh } = useStore();
  const {
    theme,
    presets,
    updateTheme,
    applyPreset,
    isLoading,
    error,
  } = useStoreTheme(currentStore?.id ?? null);

  const [localConfig, setLocalConfig] = useState<ThemeConfig | null>(null);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("design");
  const importInputRef = useRef<HTMLInputElement>(null);

  const config = localConfig ?? theme?.custom_config ?? {
    colors: {
      primary: "#6366F1",
      secondary: "#8B5CF6",
      accent: "#22C55E",
      background: "#0F172A",
      text: "#F8FAFC",
    },
    typography: { font_family: "Outfit", heading_scale: "normal" },
    button_style: "rounded",
    card_style: "elevated",
    hero_style: "centered",
    layout_density: "comfortable",
  };

  const updateColor = (key: keyof typeof config.colors) => (value: string) => {
    setLocalConfig((prev) => ({
      ...(prev ?? config),
      colors: {
        ...(prev?.colors ?? config.colors),
        [key]: value,
      },
    }));
  };

  const handleApplyPreset = async (presetId: string) => {
    if (!currentStore) return;
    setApplyingPreset(presetId);
    try {
      await applyPreset(presetId);
      setLocalConfig(null);
    } finally {
      setApplyingPreset(null);
    }
  };

  const handleSaveCustom = async () => {
    if (!currentStore) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateTheme({
        custom_config: localConfig ?? undefined,
      });
      setLocalConfig(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexora-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.colors && parsed.typography) {
          setLocalConfig(parsed);
        }
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!currentStore) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-6">Apariencia</h1>
        <EmptyState
          title="Selecciona una tienda"
          description="No hay tienda seleccionada."
        />
      </div>
    );
  }

  const selectClass = "flex-1 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">Apariencia</h1>
      <p className="text-gray-400 text-sm mb-6">
        Elegí la plantilla de tu tienda y personalizá colores, tipografía y estilos.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {activeTab === "design" && (
        <div className="space-y-10">
          <section>
            <SectionHeader
              title="Plantilla base"
              description="Elegí una plantilla base para tu tienda"
            />
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-72 rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {presets.map((preset) => (
                  <ThemePreviewCard
                    key={preset.id}
                    id={preset.id}
                    name={preset.name}
                    description={preset.description}
                    isCurrent={theme?.template_name === preset.id}
                    defaultTokens={preset.default_tokens}
                    onSelect={() => handleApplyPreset(preset.id)}
                    isLoading={applyingPreset === preset.id}
                  />
                ))}
              </div>
            )}
          </section>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Secciones</h3>
            <p className="text-sm text-gray-400 mb-4">
              Activá, desactivá y reordená las secciones de tu página principal
            </p>
            <SectionEditor
              storeId={currentStore.id}
              sections={config.sections ?? DEFAULT_SECTIONS}
              onChange={(sections) =>
                setLocalConfig((prev) => ({
                  ...(prev ?? config),
                  sections,
                }))
              }
            />
          </div>
        </div>
      )}

      {activeTab === "style" && (
        <div className="space-y-8">
          <SettingsSection
            title="Colores"
            description="Paleta de colores principal"
          >
            <div className="space-y-4">
              <ColorInputRow label="Principal" value={config.colors.primary} onChange={updateColor("primary")} />
              <ColorInputRow label="Secundario" value={config.colors.secondary} onChange={updateColor("secondary")} />
              <ColorInputRow label="Acento" value={config.colors.accent} onChange={updateColor("accent")} />
              <ColorInputRow label="Fondo" value={config.colors.background} onChange={updateColor("background")} />
              <ColorInputRow label="Texto" value={config.colors.text} onChange={updateColor("text")} />
            </div>
          </SettingsSection>

          <SettingsSection
            title="Tipografía"
            description="Fuentes del cuerpo y títulos"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm text-gray-500 font-medium">Fuente cuerpo</label>
                <select
                  value={config.typography.font_family}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...(prev ?? config),
                      typography: {
                        ...(prev?.typography ?? config.typography),
                        font_family: e.target.value,
                      },
                    }))
                  }
                  className={selectClass}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm text-gray-500 font-medium">Fuente títulos</label>
                <select
                  value={config.typography.heading_font ?? config.typography.font_family}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...(prev ?? config),
                      typography: {
                        ...(prev?.typography ?? config.typography),
                        heading_font: e.target.value,
                      },
                    }))
                  }
                  className={selectClass}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Botones y cards"
            description="Estilo de componentes"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm text-gray-500 font-medium">Botones</label>
                <select
                  value={config.button_style}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...(prev ?? config),
                      button_style: e.target.value,
                    }))
                  }
                  className={selectClass}
                >
                  {BUTTON_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm text-gray-500 font-medium">Cards</label>
                <select
                  value={config.card_style}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...(prev ?? config),
                      card_style: e.target.value,
                    }))
                  }
                  className={selectClass}
                >
                  {CARD_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsSection>
        </div>
      )}

      {activeTab === "brand" && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Marca e identidad</h3>
          <p className="text-sm text-gray-400 mb-6">
            Logo, favicon e imagen para redes sociales. Los cambios se guardan automáticamente.
          </p>
          <div className="space-y-5">
            <BrandingUpload
              label="Logo"
              currentUrl={currentStore.logo_url}
              storeId={currentStore.id}
              fieldName="logo_url"
            />
            <BrandingUpload
              label="Favicon"
              currentUrl={currentStore.favicon_url}
              storeId={currentStore.id}
              fieldName="favicon_url"
            />
            <BrandingUpload
              label="Imagen OG"
              currentUrl={currentStore.og_image_url}
              storeId={currentStore.id}
              fieldName="og_image_url"
            />
          </div>
        </div>
      )}

      {activeTab === "advanced" && (
        <div className="space-y-8">
          <SettingsSection
            title="Colores avanzados"
            description="Colores de superficie, bordes y estados"
          >
            <div className="space-y-4">
              <ColorInputRow label="Superficie" value={config.colors.surface ?? config.colors.primary + "1a"} onChange={updateColor("surface")} />
              <ColorInputRow label="Borde" value={config.colors.border ?? config.colors.text + "33"} onChange={updateColor("border")} />
              <ColorInputRow label="Éxito" value={config.colors.success ?? "#22C55E"} onChange={updateColor("success")} />
              <ColorInputRow label="Error" value={config.colors.error ?? "#EF4444"} onChange={updateColor("error")} />
              <ColorInputRow label="Advertencia" value={config.colors.warning ?? "#F59E0B"} onChange={updateColor("warning")} />
            </div>
          </SettingsSection>

          <SettingsSection
            title="Tipografía avanzada"
            description="Peso de títulos y tamaño del cuerpo"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm text-gray-500 font-medium">Peso títulos</label>
                <select
                  value={config.typography.heading_weight ?? "bold"}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...(prev ?? config),
                      typography: {
                        ...(prev?.typography ?? config.typography),
                        heading_weight: e.target.value,
                      },
                    }))
                  }
                  className={selectClass}
                >
                  {HEADING_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="w-28 text-sm text-gray-500 font-medium">Tamaño cuerpo</label>
                <select
                  value={config.typography.body_size ?? "normal"}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...(prev ?? config),
                      typography: {
                        ...(prev?.typography ?? config.typography),
                        body_size: e.target.value,
                      },
                    }))
                  }
                  className={selectClass}
                >
                  {BODY_SIZES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Modo de color"
            description="Tema claro, oscuro o automático"
          >
            <div className="flex items-center gap-4">
              <label className="w-28 text-sm text-gray-500 font-medium">Modo</label>
              <select
                value={config.color_mode ?? "light"}
                onChange={(e) =>
                  setLocalConfig((prev) => ({
                    ...(prev ?? config),
                    color_mode: e.target.value,
                  }))
                }
                className={selectClass}
              >
                {COLOR_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Banner personalizado"
            description="Texto del banner en la parte superior de tu tienda"
          >
            <input
              type="text"
              value={config.custom_banner ?? ""}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...(prev ?? config),
                  custom_banner: e.target.value,
                }))
              }
              placeholder="Texto del banner (opcional)"
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none text-sm"
            />
          </SettingsSection>

          <SettingsSection
            title="CSS personalizado"
            description="CSS avanzado que se inyecta en tu tienda"
          >
            <textarea
              value={config.custom_css ?? ""}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...(prev ?? config),
                  custom_css: e.target.value,
                }))
              }
              placeholder="/* Escribí tu CSS personalizado aquí */"
              rows={10}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none text-sm"
              style={{
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                backgroundColor: "#1e1e2e",
                tabSize: 2,
              }}
            />
          </SettingsSection>

          <SettingsSection
            title="Importar / Exportar"
            description="Descargá o cargá tu configuración de tema como archivo JSON"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exportar tema
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Importar tema
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </SettingsSection>
        </div>
      )}

      <div className="mt-10 pt-8 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-500 mb-3">Vista previa</p>
        <LivePreview
          config={config}
          templateName={theme?.template_name || "streetwear"}
        />
      </div>

      {saveSuccess && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          Cambios guardados correctamente.
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {localConfig && (
          <button
            type="button"
            onClick={() => setLocalConfig(null)}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-white border border-gray-200 shadow-lg hover:bg-gray-50 transition-colors"
          >
            Descartar
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveCustom}
          disabled={saving || !localConfig}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 ${
            localConfig
              ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
