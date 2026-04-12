"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/context/StoreContext";
import {
  listPages,
  createPage,
  updatePage,
  deletePage,
  type StorePage,
  type PageBlock,
} from "@/lib/api/pages";
import {
  FileText,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
  X,
  Type,
  Image,
  Video,
  ShoppingBag,
  MousePointerClick,
} from "lucide-react";

const BLOCK_TYPES = [
  { type: "text" as const, label: "Texto", icon: Type },
  { type: "image" as const, label: "Imagen", icon: Image },
  { type: "video" as const, label: "Video", icon: Video },
  { type: "products" as const, label: "Productos", icon: ShoppingBag },
  { type: "cta" as const, label: "CTA", icon: MousePointerClick },
];

function defaultConfig(type: PageBlock["type"]): Record<string, any> {
  switch (type) {
    case "text":
      return { content: "" };
    case "image":
      return { url: "", alt: "" };
    case "video":
      return { url: "" };
    case "products":
      return { product_ids: "" };
    case "cta":
      return { title: "", url: "", button_text: "Ver más" };
    default:
      return {};
  }
}

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  block: PageBlock;
  index: number;
  total: number;
  onChange: (config: Record<string, any>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const meta = BLOCK_TYPES.find((b) => b.type === block.type);
  const Icon = meta?.icon ?? Type;

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 flex-1">
          {meta?.label ?? block.type}
        </span>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 rounded hover:bg-red-100 text-red-500 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        {block.type === "text" && (
          <textarea
            value={block.config.content ?? ""}
            onChange={(e) => onChange({ ...block.config, content: e.target.value })}
            rows={4}
            placeholder="Escribe el contenido de texto..."
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none text-sm"
          />
        )}
        {block.type === "image" && (
          <>
            <input
              type="text"
              value={block.config.url ?? ""}
              onChange={(e) => onChange({ ...block.config, url: e.target.value })}
              placeholder="URL de la imagen"
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
            />
            <input
              type="text"
              value={block.config.alt ?? ""}
              onChange={(e) => onChange({ ...block.config, alt: e.target.value })}
              placeholder="Texto alternativo (alt)"
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
            />
          </>
        )}
        {block.type === "video" && (
          <input
            type="text"
            value={block.config.url ?? ""}
            onChange={(e) => onChange({ ...block.config, url: e.target.value })}
            placeholder="URL del video (YouTube, Vimeo, o enlace directo)"
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
          />
        )}
        {block.type === "products" && (
          <input
            type="text"
            value={block.config.product_ids ?? ""}
            onChange={(e) => onChange({ ...block.config, product_ids: e.target.value })}
            placeholder="IDs de productos separados por coma"
            className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
          />
        )}
        {block.type === "cta" && (
          <>
            <input
              type="text"
              value={block.config.title ?? ""}
              onChange={(e) => onChange({ ...block.config, title: e.target.value })}
              placeholder="Título del CTA"
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
            />
            <input
              type="text"
              value={block.config.url ?? ""}
              onChange={(e) => onChange({ ...block.config, url: e.target.value })}
              placeholder="URL de destino"
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
            />
            <input
              type="text"
              value={block.config.button_text ?? "Ver más"}
              onChange={(e) => onChange({ ...block.config, button_text: e.target.value })}
              placeholder="Texto del botón"
              className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function PagesAdminPage() {
  const { currentStore } = useStore();
  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<StorePage | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

  const fetchPages = useCallback(async () => {
    if (!currentStore) return;
    try {
      const data = await listPages(currentStore.id);
      setPages(data);
    } catch {
      setError("Error al cargar páginas");
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleCreate = async () => {
    if (!currentStore || !newTitle.trim() || !newSlug.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const page = await createPage(currentStore.id, {
        title: newTitle.trim(),
        slug: newSlug.trim().toLowerCase().replace(/\s+/g, "-"),
        blocks: [],
      });
      setPages((prev) => [...prev, page]);
      setShowCreate(false);
      setNewTitle("");
      setNewSlug("");
      setEditingPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear página");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!currentStore || !editingPage) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updatePage(currentStore.id, editingPage.id, {
        title: editingPage.title,
        slug: editingPage.slug,
        blocks: editingPage.blocks,
        is_published: editingPage.is_published,
        sort_order: editingPage.sort_order,
      });
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPage(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pageId: string) => {
    if (!currentStore || !confirm("¿Eliminar esta página?")) return;
    try {
      await deletePage(currentStore.id, pageId);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      if (editingPage?.id === pageId) setEditingPage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const togglePublish = async (page: StorePage) => {
    if (!currentStore) return;
    try {
      const updated = await updatePage(currentStore.id, page.id, {
        is_published: !page.is_published,
      });
      setPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (editingPage?.id === updated.id) setEditingPage(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const addBlock = (type: PageBlock["type"]) => {
    if (!editingPage) return;
    const newBlock: PageBlock = { type, config: defaultConfig(type) };
    setEditingPage({
      ...editingPage,
      blocks: [...editingPage.blocks, newBlock],
    });
    setShowBlockMenu(false);
  };

  const updateBlock = (index: number, config: Record<string, any>) => {
    if (!editingPage) return;
    const blocks = [...editingPage.blocks];
    blocks[index] = { ...blocks[index], config };
    setEditingPage({ ...editingPage, blocks });
  };

  const removeBlock = (index: number) => {
    if (!editingPage) return;
    const blocks = editingPage.blocks.filter((_, i) => i !== index);
    setEditingPage({ ...editingPage, blocks });
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    if (!editingPage) return;
    const blocks = [...editingPage.blocks];
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    setEditingPage({ ...editingPage, blocks });
  };

  if (!currentStore) {
    return (
      <div>
        <h1 className="text-2xl font-display font-bold text-gray-900 mb-6">Páginas</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Selecciona una tienda primero.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900 mb-1">Páginas</h1>
          <p className="text-gray-400 text-sm">Crea y gestiona páginas personalizadas para tu tienda.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition"
        >
          <Plus className="w-4 h-4" />
          Nueva página
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">
            Cerrar
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Nueva página</h2>
            <button
              onClick={() => {
                setShowCreate(false);
                setNewTitle("");
                setNewSlug("");
              }}
              className="p-1 rounded hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Título</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  setNewSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, "")
                      .replace(/\s+/g, "-"),
                  );
                }}
                placeholder="Ej: Sobre nosotros"
                className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Slug (URL)</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="sobre-nosotros"
                className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !newTitle.trim() || !newSlug.trim()}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {saving ? "Creando..." : "Crear página"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : pages.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Sin páginas</h2>
          <p className="text-gray-500 text-sm mb-6">
            Crea páginas personalizadas como &quot;Sobre nosotros&quot;, &quot;FAQ&quot; o
            &quot;Políticas&quot;.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            Crear primera página
          </button>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {pages.map((page) => (
            <div
              key={page.id}
              className={`flex items-center gap-3 bg-white border rounded-xl px-5 py-4 cursor-pointer transition hover:shadow-sm ${
                editingPage?.id === page.id
                  ? "border-indigo-300 ring-1 ring-indigo-200"
                  : "border-gray-200"
              }`}
              onClick={() =>
                setEditingPage(editingPage?.id === page.id ? null : { ...page })
              }
            >
              <FileText className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{page.title}</p>
                <p className="text-xs text-gray-400">/{page.slug}</p>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  page.is_published
                    ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {page.is_published ? "Publicada" : "Borrador"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePublish(page);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title={page.is_published ? "Despublicar" : "Publicar"}
              >
                {page.is_published ? (
                  <Eye className="w-4 h-4 text-green-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(page.id);
                }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editingPage && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Editando: {editingPage.title}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                <Save className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditingPage(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1.5">Título</label>
              <input
                type="text"
                value={editingPage.title}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, title: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Slug</label>
              <input
                type="text"
                value={editingPage.slug}
                onChange={(e) =>
                  setEditingPage({ ...editingPage, slug: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {editingPage.blocks.map((block, i) => (
              <BlockEditor
                key={i}
                block={block}
                index={i}
                total={editingPage.blocks.length}
                onChange={(config) => updateBlock(i, config)}
                onRemove={() => removeBlock(i)}
                onMove={(dir) => moveBlock(i, dir)}
              />
            ))}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowBlockMenu(!showBlockMenu)}
              className="inline-flex items-center gap-2 border border-dashed border-gray-300 text-gray-500 px-4 py-3 rounded-xl font-medium text-sm hover:border-indigo-300 hover:text-indigo-600 transition w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              Agregar bloque
            </button>
            {showBlockMenu && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 p-2 grid grid-cols-5 gap-1">
                {BLOCK_TYPES.map((bt) => {
                  const BIcon = bt.icon;
                  return (
                    <button
                      key={bt.type}
                      onClick={() => addBlock(bt.type)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-indigo-50 transition text-gray-600 hover:text-indigo-600"
                    >
                      <BIcon className="w-5 h-5" />
                      <span className="text-xs font-medium">{bt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
