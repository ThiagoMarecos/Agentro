"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Layout,
  Package,
  Grid3X3,
  Zap,
  MessageSquare,
  Mail,
  FileText,
  Settings,
  Plus,
  Trash2,
  Copy,
  Image,
  Megaphone,
  Minus,
  Play,
  ChevronDown,
  Upload,
  Layers,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { uploadImage, uploadVideo } from "@/lib/api/products";
import { canMerge, getHybridCombo, getComboFromTypes } from "./hybridCombos";

interface Section {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  config: Record<string, any>;
}

interface SectionEditorProps {
  sections: Section[];
  onChange: (sections: Section[]) => void;
  storeId: string;
}

const SECTION_META: Record<string, { label: string; icon: LucideIcon }> = {
  hero: { label: "Hero / Banner", icon: Layout },
  featured_products: { label: "Productos destacados", icon: Package },
  categories: { label: "Categorías", icon: Grid3X3 },
  drops: { label: "Drops", icon: Zap },
  testimonials: { label: "Testimonios", icon: MessageSquare },
  newsletter: { label: "Newsletter", icon: Mail },
  custom_text: { label: "Texto personalizado", icon: FileText },
  image_slider: { label: "Slider de imágenes", icon: Image },
  banner: { label: "Banner promocional", icon: Megaphone },
  divider: { label: "Separador", icon: Minus },
  video: { label: "Video", icon: Play },
};

const DEFAULT_CONFIGS: Record<string, Record<string, any>> = {
  hero: { style: "centered", title: "", subtitle: "", cta_text: "Ver catálogo", bg_image: "" },
  featured_products: { columns: 4, count: 8, show_price: true },
  categories: { layout: "grid" },
  drops: {},
  testimonials: { items: [] },
  newsletter: { title: "", description: "" },
  custom_text: { title: "", body: "", image: "" },
  image_slider: { images: [], autoplay: true, interval: 5, height: "medium" },
  banner: { title: "", subtitle: "", link: "", bg_color: "", alignment: "center" },
  divider: { style: "line", height: 40 },
  video: { url: "", title: "", autoplay: false },
};

function ensureId(section: Section, index: number): Section {
  if (section.id) return section;
  return { ...section, id: `${section.type}_${index}` };
}

function Toggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SliderImageUpload({
  storeId,
  currentUrl,
  onUploaded,
}: {
  storeId: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = localUrl ?? currentUrl;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadImage(storeId, file);
      setLocalUrl(url);
      onUploaded(url);
    } catch (err: any) {
      setError(err?.message || "Error al subir imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0"
            onError={() => setError("No se pudo cargar la imagen")}
          />
        ) : (
          <div className="w-10 h-10 rounded border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
            <Image className="w-4 h-4 text-gray-400" />
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Subiendo..." : "Subir imagen"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

function MergeDropZone({
  sectionId,
  sectionType,
  draggedType,
}: {
  sectionId: string;
  sectionType: string;
  draggedType: string | null;
}) {
  const mergeId = `merge::${sectionId}`;
  const { setNodeRef, isOver } = useDroppable({ id: mergeId });

  const compatible = draggedType ? canMerge(sectionType, draggedType) : false;
  if (!draggedType || !compatible) return null;

  const combo = getHybridCombo(sectionType, draggedType);

  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
        isOver
          ? "border-purple-500 bg-purple-50/80 backdrop-blur-sm"
          : "border-purple-300 bg-purple-50/40"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white shadow-md border border-purple-200">
        <Layers className="w-5 h-5 text-purple-600" />
        <span className="text-sm font-medium text-purple-700">
          {isOver ? `Fusionar: ${combo?.label ?? "Híbrida"}` : "Soltar para fusionar"}
        </span>
      </div>
    </div>
  );
}

function SortableRow({
  section,
  instanceLabel,
  expanded,
  storeId,
  draggedType,
  onToggleEnabled,
  onToggleExpand,
  onConfigChange,
  onDelete,
  onDuplicate,
  onSplit,
}: {
  section: Section;
  instanceLabel: string | null;
  expanded: boolean;
  storeId: string;
  draggedType: string | null;
  onToggleEnabled: () => void;
  onToggleExpand: () => void;
  onConfigChange: (config: Record<string, any>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isHybrid = section.type === "hybrid";
  const combo = isHybrid ? getComboFromTypes(section.config.types) : null;
  const sectionType = isHybrid
    ? section.config.types?.[0] ?? "hero"
    : section.type;
  const meta = isHybrid ? null : SECTION_META[section.type];
  const label = isHybrid ? (combo?.label ?? "Sección Híbrida") : meta?.label;
  const Icon = isHybrid ? (combo?.icon ?? Layers) : meta?.icon;

  if (!isHybrid && !meta) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-xl border transition-all duration-200 ${
        isDragging ? "z-50 shadow-lg opacity-50" : ""
      } ${
        isHybrid
          ? "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200/60 shadow-sm"
          : section.enabled
            ? "bg-white border-gray-200/60 shadow-sm"
            : "bg-gray-50/70 border-gray-100"
      }`}
    >
      {!isDragging && !isHybrid && (
        <MergeDropZone
          sectionId={section.id}
          sectionType={section.type}
          draggedType={draggedType}
        />
      )}

      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          className="cursor-grab touch-none text-gray-300 hover:text-gray-500 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {isHybrid ? (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-purple-100 text-purple-600">
            <Layers className="w-[18px] h-[18px]" />
          </div>
        ) : (
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              section.enabled
                ? "bg-indigo-50 text-indigo-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {Icon && <Icon className="w-[18px] h-[18px]" />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-medium transition-colors ${
              isHybrid
                ? "text-purple-800"
                : section.enabled
                  ? "text-gray-900"
                  : "text-gray-400"
            }`}
          >
            {label}
          </span>
          {isHybrid && (
            <span className="ml-2 text-xs text-purple-500 font-normal">
              Híbrida
            </span>
          )}
          {instanceLabel && !isHybrid && (
            <span className="ml-2 text-xs text-gray-400 font-normal">
              {instanceLabel}
            </span>
          )}
        </div>

        <Toggle checked={section.enabled} onToggle={onToggleEnabled} />

        {isHybrid && onSplit && (
          <button
            type="button"
            onClick={onSplit}
            className="p-2 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-100 transition-colors"
            title="Separar secciones"
          >
            <Unlink className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onDuplicate}
          className="p-2 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
          title="Duplicar sección"
        >
          <Copy className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Eliminar sección"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          className={`p-2 rounded-lg transition-colors ${
            expanded
              ? "bg-indigo-50 text-indigo-600"
              : "text-gray-300 hover:text-gray-500 hover:bg-gray-100"
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          expanded ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          {isHybrid ? (
            <HybridConfigPanel
              types={section.config.types}
              config={section.config}
              onChange={onConfigChange}
              storeId={storeId}
            />
          ) : (
            <ConfigPanel
              type={section.type}
              config={section.config}
              onChange={onConfigChange}
              storeId={storeId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function VideoConfigPanel({
  config,
  onChange,
  storeId,
  inputClass,
  labelClass,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  storeId: string;
  inputClass: string;
  labelClass: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const source: "url" | "file" = config.source ?? "url";
  const update = (key: string, value: any) => onChange({ ...config, [key]: value });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadVideo(storeId, file);
      update("url", url);
      update("source", "file");
    } catch (err: any) {
      setError(err?.message || "Error al subir video");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Origen del video</label>
        <div className="flex gap-1 p-1 rounded-lg bg-gray-100 max-w-xs">
          <button
            type="button"
            onClick={() => { update("source", "url"); update("url", ""); }}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              source === "url"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            URL (YouTube/Vimeo)
          </button>
          <button
            type="button"
            onClick={() => { update("source", "file"); update("url", ""); }}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              source === "file"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Subir archivo
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {source === "url" ? (
          <div>
            <label className={labelClass}>URL del video</label>
            <input
              className={inputClass}
              value={config.url ?? ""}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Archivo de video</label>
            <div className="flex items-center gap-3">
              {config.url && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium shrink-0">
                  <Play className="w-3.5 h-3.5" />
                  Video cargado
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "Subiendo..." : config.url ? "Cambiar video" : "Subir video"}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <p className="text-xs text-gray-400 mt-1">MP4, WebM o MOV. Máximo 100MB.</p>
          </div>
        )}
        <div>
          <label className={labelClass}>Título</label>
          <input
            className={inputClass}
            value={config.title ?? ""}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Título del video"
          />
        </div>
      </div>
      <div className="flex items-end pb-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.autoplay ?? false}
            onChange={(e) => update("autoplay", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Autoplay</span>
        </label>
      </div>
    </div>
  );
}

function ConfigPanel({
  type,
  config,
  onChange,
  storeId,
}: {
  type: string;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  storeId: string;
}) {
  const update = (key: string, value: any) =>
    onChange({ ...config, [key]: value });

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition";
  const selectClass =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition appearance-none";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";

  switch (type) {
    case "hero":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Estilo</label>
            <select
              className={selectClass}
              value={config.style ?? "centered"}
              onChange={(e) => update("style", e.target.value)}
            >
              <option value="centered">Centrado</option>
              <option value="fullwidth">Ancho completo</option>
              <option value="split">Dividido</option>
              <option value="gradient">Gradiente</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Título</label>
            <input
              className={inputClass}
              value={config.title ?? ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Título principal"
            />
          </div>
          <div>
            <label className={labelClass}>Subtítulo</label>
            <input
              className={inputClass}
              value={config.subtitle ?? ""}
              onChange={(e) => update("subtitle", e.target.value)}
              placeholder="Subtítulo"
            />
          </div>
          <div>
            <label className={labelClass}>Texto CTA</label>
            <input
              className={inputClass}
              value={config.cta_text ?? ""}
              onChange={(e) => update("cta_text", e.target.value)}
              placeholder="Ver más"
            />
          </div>
        </div>
      );

    case "featured_products":
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Columnas</label>
            <select
              className={selectClass}
              value={config.columns ?? 3}
              onChange={(e) => update("columns", Number(e.target.value))}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Cantidad</label>
            <input
              type="number"
              className={inputClass}
              min={1}
              max={24}
              value={config.count ?? 6}
              onChange={(e) => update("count", Number(e.target.value))}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.show_price ?? true}
                onChange={(e) => update("show_price", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Mostrar precio</span>
            </label>
          </div>
        </div>
      );

    case "categories":
      return (
        <div className="max-w-xs">
          <label className={labelClass}>Layout</label>
          <select
            className={selectClass}
            value={config.layout ?? "grid"}
            onChange={(e) => update("layout", e.target.value)}
          >
            <option value="grid">Grilla</option>
            <option value="carousel">Carrusel</option>
            <option value="list">Lista</option>
          </select>
        </div>
      );

    case "drops":
      return (
        <p className="text-sm text-gray-400 italic">
          Esta sección no tiene configuración adicional.
        </p>
      );

    case "testimonials": {
      const items: { name: string; text: string }[] = config.items ?? [];
      return (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <div className="flex-1 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Nombre</label>
                  <input
                    className={inputClass}
                    value={item.name}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], name: e.target.value };
                      update("items", next);
                    }}
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <label className={labelClass}>Testimonio</label>
                  <input
                    className={inputClass}
                    value={item.text}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], text: e.target.value };
                      update("items", next);
                    }}
                    placeholder="Texto del testimonio"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = items.filter((_, i) => i !== idx);
                  update("items", next);
                }}
                className="mt-6 p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => update("items", [...items, { name: "", text: "" }])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Agregar testimonio
          </button>
        </div>
      );
    }

    case "newsletter":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Título</label>
            <input
              className={inputClass}
              value={config.title ?? ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Suscríbete"
            />
          </div>
          <div>
            <label className={labelClass}>Descripción</label>
            <input
              className={inputClass}
              value={config.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Recibe nuestras novedades"
            />
          </div>
        </div>
      );

    case "custom_text":
      return (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Título</label>
            <input
              className={inputClass}
              value={config.title ?? ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Título de la sección"
            />
          </div>
          <div>
            <label className={labelClass}>Contenido</label>
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              value={config.body ?? ""}
              onChange={(e) => update("body", e.target.value)}
              placeholder="Escribe tu texto aquí..."
            />
          </div>
        </div>
      );

    case "image_slider": {
      const images: { url: string; alt: string; link: string }[] = config.images ?? [];
      return (
        <div className="space-y-4">
          <div className="space-y-3">
            {images.map((img, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Imagen</label>
                    <SliderImageUpload
                      storeId={storeId}
                      currentUrl={img.url || undefined}
                      onUploaded={(url) => {
                        const next = [...images];
                        next[idx] = { ...next[idx], url };
                        update("images", next);
                      }}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Texto alt</label>
                    <input
                      className={inputClass}
                      value={img.alt}
                      onChange={(e) => {
                        const next = [...images];
                        next[idx] = { ...next[idx], alt: e.target.value };
                        update("images", next);
                      }}
                      placeholder="Descripción de la imagen"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Enlace</label>
                    <input
                      className={inputClass}
                      value={img.link}
                      onChange={(e) => {
                        const next = [...images];
                        next[idx] = { ...next[idx], link: e.target.value };
                        update("images", next);
                      }}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = images.filter((_, i) => i !== idx);
                    update("images", next);
                  }}
                  className="mt-6 p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                update("images", [...images, { url: "", alt: "", link: "" }])
              }
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar imagen
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Tamaño del banner</label>
              <select
                className={selectClass}
                value={config.height ?? "medium"}
                onChange={(e) => update("height", e.target.value)}
              >
                <option value="small">Franja (1920 × 300 px)</option>
                <option value="medium">Banner (1920 × 450 px)</option>
                <option value="large">Pantalla completa (1920 × 600 px)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Subí imágenes con estas medidas para que se vean bien.</p>
            </div>
            <div>
              <label className={labelClass}>Intervalo (seg)</label>
              <input
                type="number"
                className={inputClass}
                min={1}
                max={30}
                value={config.interval ?? 5}
                onChange={(e) => update("interval", Number(e.target.value))}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.autoplay ?? true}
                  onChange={(e) => update("autoplay", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Rotación automática</span>
              </label>
            </div>
          </div>
        </div>
      );
    }

    case "banner":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Título</label>
            <input
              className={inputClass}
              value={config.title ?? ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Título del banner"
            />
          </div>
          <div>
            <label className={labelClass}>Subtítulo</label>
            <input
              className={inputClass}
              value={config.subtitle ?? ""}
              onChange={(e) => update("subtitle", e.target.value)}
              placeholder="Subtítulo"
            />
          </div>
          <div>
            <label className={labelClass}>Enlace</label>
            <input
              className={inputClass}
              value={config.link ?? ""}
              onChange={(e) => update("link", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelClass}>Color de fondo (hex)</label>
            <input
              className={inputClass}
              value={config.bg_color ?? ""}
              onChange={(e) => update("bg_color", e.target.value)}
              placeholder="#6366f1"
            />
          </div>
          <div>
            <label className={labelClass}>Alineación</label>
            <select
              className={selectClass}
              value={config.alignment ?? "center"}
              onChange={(e) => update("alignment", e.target.value)}
            >
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </div>
        </div>
      );

    case "divider":
      return (
        <div className="grid gap-4 sm:grid-cols-2 max-w-md">
          <div>
            <label className={labelClass}>Estilo</label>
            <select
              className={selectClass}
              value={config.style ?? "line"}
              onChange={(e) => update("style", e.target.value)}
            >
              <option value="line">Línea</option>
              <option value="dots">Puntos</option>
              <option value="space">Espacio</option>
              <option value="wave">Onda</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Altura (px)</label>
            <input
              type="number"
              className={inputClass}
              min={8}
              max={200}
              value={config.height ?? 40}
              onChange={(e) => update("height", Number(e.target.value))}
            />
          </div>
        </div>
      );

    case "video":
      return (
        <VideoConfigPanel
          config={config}
          onChange={onChange}
          storeId={storeId}
          inputClass={inputClass}
          labelClass={labelClass}
        />
      );

    default:
      return null;
  }
}

type VideoLayout = "right" | "left" | "top" | "bottom" | "background";

const VIDEO_LAYOUTS: { value: VideoLayout; label: string; icon: string }[] = [
  { value: "right", label: "Derecha", icon: "◧" },
  { value: "left", label: "Izquierda", icon: "◨" },
  { value: "top", label: "Arriba", icon: "⬒" },
  { value: "bottom", label: "Abajo", icon: "⬓" },
  { value: "background", label: "Fondo completo", icon: "▣" },
];

function LayoutPicker({
  value,
  onChange,
}: {
  value: VideoLayout;
  onChange: (v: VideoLayout) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-2">
        Disposición del video
      </label>
      <div className="flex gap-1.5">
        {VIDEO_LAYOUTS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              value === opt.value
                ? "bg-purple-50 border-purple-300 text-purple-700 shadow-sm"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <span className="text-lg leading-none">{opt.icon}</span>
            <span className="truncate">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HybridConfigPanel({
  types,
  config,
  onChange,
  storeId,
}: {
  types: [string, string];
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  storeId: string;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const hasVideo = types.includes("video");
  const currentLayout: VideoLayout = config.layout ?? "right";

  const labels = types.map((t) => SECTION_META[t]?.label ?? t);

  return (
    <div className="space-y-4">
      {hasVideo && (
        <LayoutPicker
          value={currentLayout}
          onChange={(v) => onChange({ ...config, layout: v })}
        />
      )}

      <div className="flex gap-1 p-1 rounded-lg bg-gray-100">
        {types.map((t, idx) => {
          const TabIcon = SECTION_META[t]?.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all ${
                activeTab === idx
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
              {labels[idx]}
            </button>
          );
        })}
      </div>
      <ConfigPanel
        type={types[activeTab]}
        config={config[types[activeTab]] ?? {}}
        onChange={(subConfig) =>
          onChange({ ...config, [types[activeTab]]: subConfig })
        }
        storeId={storeId}
      />
    </div>
  );
}

const mergeFirstCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const mergeHit = pointerCollisions.find((c) =>
    String(c.id).startsWith("merge::")
  );
  if (mergeHit) return [mergeHit];
  return closestCenter(args);
};

export function SectionEditor({ sections, onChange, storeId }: SectionEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const normalized = sections.map((s, i) => ensureId(s, i));
  const sorted = [...normalized].sort((a, b) => a.order - b.order);

  const draggedSection = draggedId
    ? normalized.find((s) => s.id === draggedId)
    : null;
  const draggedType = draggedSection
    ? draggedSection.type === "hybrid"
      ? null
      : draggedSection.type
    : null;

  const typeCounts: Record<string, number> = {};
  for (const s of sorted) {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  }

  const typeInstanceIndex: Record<string, number> = {};
  const instanceLabels = new Map<string, string | null>();
  for (const s of sorted) {
    typeInstanceIndex[s.type] = (typeInstanceIndex[s.type] || 0) + 1;
    instanceLabels.set(
      s.id,
      typeCounts[s.type] > 1 ? `#${typeInstanceIndex[s.type]}` : null
    );
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAddMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setDraggedId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggedId(null);

    if (!over) return;

    const overId = over.id as string;

    if (overId.startsWith("merge::")) {
      const targetId = overId.replace("merge::", "");
      const sourceSection = normalized.find((s) => s.id === active.id);
      const targetSection = normalized.find((s) => s.id === targetId);

      if (
        sourceSection &&
        targetSection &&
        sourceSection.type !== "hybrid" &&
        targetSection.type !== "hybrid" &&
        canMerge(sourceSection.type, targetSection.type)
      ) {
        const combo = getHybridCombo(sourceSection.type, targetSection.type);
        if (combo) {
          const hybridSection: Section = {
            id: crypto.randomUUID(),
            type: "hybrid",
            enabled: true,
            order: targetSection.order,
            config: {
              types: [combo.primary, combo.secondary] as [string, string],
              [combo.primary]:
                sourceSection.type === combo.primary
                  ? { ...sourceSection.config }
                  : { ...targetSection.config },
              [combo.secondary]:
                sourceSection.type === combo.secondary
                  ? { ...sourceSection.config }
                  : { ...targetSection.config },
            },
          };

          const updated = normalized
            .filter((s) => s.id !== active.id && s.id !== targetId)
            .concat(hybridSection)
            .sort((a, b) => a.order - b.order)
            .map((s, i) => ({ ...s, order: i }));

          onChange(updated);
          setExpandedId(hybridSection.id);
          return;
        }
      }
    }

    if (active.id === over.id) return;

    const oldIndex = sorted.findIndex((s) => s.id === active.id);
    const newIndex = sorted.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i,
    }));
    onChange(reordered);
  }

  function handleDragCancel() {
    setDraggedId(null);
  }

  function toggleEnabled(id: string) {
    onChange(
      normalized.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  function updateConfig(id: string, config: Record<string, any>) {
    onChange(
      normalized.map((s) => (s.id === id ? { ...s, config } : s))
    );
  }

  function handleAddSection(type: string) {
    const maxOrder = normalized.length > 0
      ? Math.max(...normalized.map((s) => s.order))
      : -1;
    const newSection: Section = {
      id: crypto.randomUUID(),
      type,
      enabled: true,
      order: maxOrder + 1,
      config: { ...(DEFAULT_CONFIGS[type] || {}) },
    };
    onChange([...normalized, newSection]);
    setShowAddMenu(false);
  }

  function handleDeleteSection(id: string) {
    const updated = normalized
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, order: i }));
    onChange(updated);
    setDeletingId(null);
    if (expandedId === id) setExpandedId(null);
  }

  function handleDuplicateSection(id: string) {
    const source = normalized.find((s) => s.id === id);
    if (!source) return;
    const maxOrder = Math.max(...normalized.map((s) => s.order));
    const duplicate: Section = {
      ...source,
      id: crypto.randomUUID(),
      order: maxOrder + 1,
      config: JSON.parse(JSON.stringify(source.config)),
    };
    onChange([...normalized, duplicate]);
  }

  function handleSplitSection(id: string) {
    const section = normalized.find((s) => s.id === id);
    if (!section || section.type !== "hybrid") return;

    const types: [string, string] = section.config.types;
    const sectionA: Section = {
      id: crypto.randomUUID(),
      type: types[0],
      enabled: section.enabled,
      order: section.order,
      config: { ...(DEFAULT_CONFIGS[types[0]] || {}), ...(section.config[types[0]] || {}) },
    };
    const sectionB: Section = {
      id: crypto.randomUUID(),
      type: types[1],
      enabled: section.enabled,
      order: section.order + 0.5,
      config: { ...(DEFAULT_CONFIGS[types[1]] || {}), ...(section.config[types[1]] || {}) },
    };

    const updated = normalized
      .filter((s) => s.id !== id)
      .concat(sectionA, sectionB)
      .sort((a, b) => a.order - b.order)
      .map((s, i) => ({ ...s, order: i }));

    onChange(updated);
    if (expandedId === id) setExpandedId(null);
  }

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={mergeFirstCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sorted.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sorted.map((section) => (
              <SortableRow
                key={section.id}
                section={section}
                instanceLabel={instanceLabels.get(section.id) ?? null}
                expanded={expandedId === section.id}
                storeId={storeId}
                draggedType={draggedId === section.id ? null : draggedType}
                onToggleEnabled={() => toggleEnabled(section.id)}
                onToggleExpand={() =>
                  setExpandedId(expandedId === section.id ? null : section.id)
                }
                onConfigChange={(config) => updateConfig(section.id, config)}
                onDelete={() => setDeletingId(section.id)}
                onDuplicate={() => handleDuplicateSection(section.id)}
                onSplit={section.type === "hybrid" ? () => handleSplitSection(section.id) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="relative" ref={addMenuRef}>
        <button
          type="button"
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all duration-200 w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Agregar sección
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              showAddMenu ? "rotate-180" : ""
            }`}
          />
        </button>

        {showAddMenu && (
          <div className="absolute z-50 mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
            {Object.entries(SECTION_META).map(([type, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAddSection(type)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 shrink-0 text-gray-400" />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {deletingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Eliminar sección
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              ¿Estás seguro de que deseas eliminar esta sección? Esta acción no
              se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSection(deletingId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
