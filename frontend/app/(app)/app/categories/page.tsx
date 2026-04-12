"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import {
  getCategories,
  deleteCategory,
  updateCategory,
  type Category,
} from "@/lib/api/categories";
import { getProducts } from "@/lib/api/products";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  FolderOpen,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  Package,
  Layers,
} from "lucide-react";

/* ── Skeleton row ─────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-4 py-3.5 w-10">
        <div className="w-5 h-5 rounded bg-gray-100 animate-pulse" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-4 w-36 bg-gray-100 rounded animate-pulse mb-1.5" />
        <div className="h-3 w-24 bg-gray-50 rounded animate-pulse" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-5 w-20 bg-gray-100 rounded-full animate-pulse" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
      </td>
      <td className="px-4 py-3.5">
        <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex gap-1 justify-end">
          <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
          <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </td>
    </tr>
  );
}

/* ── Confirm modal ────────────────────────────────── */
function ConfirmModal({
  open,
  title,
  message,
  count,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  count?: number;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{message}</p>
            {count != null && count > 0 && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                <Trash2 className="w-3 h-3" />
                {count} categoria{count !== 1 ? "s" : ""} seleccionada{count !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {loading && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────── */
export default function CategoriesPage() {
  const { currentStore } = useStore();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search
  const [search, setSearch] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    setError("");
    try {
      const [cats, prodRes] = await Promise.all([
        getCategories(currentStore.id),
        getProducts(currentStore.id, { limit: 100 }),
      ]);
      setCategories(cats);
      const counts: Record<string, number> = {};
      for (const p of prodRes.items) {
        if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
      setProductCounts(counts);
    } catch {
      setCategories([]);
      setError("Error al cargar categorias");
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear selection when categories change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [categories]);

  /* ── Handlers ── */

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    if (!currentStore) return;
    try {
      await updateCategory(currentStore.id, cat.id, { is_active: !cat.is_active });
      showToast(cat.is_active ? "Categoria desactivada" : "Categoria activada");
      fetchData();
    } catch {
      showToast("Error al cambiar estado", "error");
    }
  };

  const openDeleteSingle = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setShowDeleteModal(true);
  };

  const openDeleteBulk = () => {
    setDeleteTarget(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentStore) return;
    setBulkDeleting(true);
    try {
      if (deleteTarget) {
        // Single delete
        await deleteCategory(currentStore.id, deleteTarget.id);
        showToast(`"${deleteTarget.name}" eliminada`);
      } else {
        // Bulk delete
        let deleted = 0;
        for (const id of Array.from(selectedIds)) {
          try {
            await deleteCategory(currentStore.id, id);
            deleted++;
          } catch { /* continue */ }
        }
        showToast(`${deleted} categoria${deleted !== 1 ? "s" : ""} eliminada${deleted !== 1 ? "s" : ""}`);
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setSelectedIds(new Set());
      fetchData();
    } catch {
      showToast("Error al eliminar", "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ── Filtered list ── */
  const filtered = categories.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasSelection = selectedIds.size > 0;
  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const isSomeSelected = hasSelection && !isAllSelected;
  const activeCount = categories.filter((c) => c.is_active).length;
  const inactiveCount = categories.length - activeCount;

  if (!currentStore) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Selecciona una tienda para ver las categorias
      </div>
    );
  }

  return (
    <div>
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Categorias</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading
              ? "Cargando..."
              : `${categories.length} categoria${categories.length !== 1 ? "s" : ""} en tu catalogo`}
          </p>
        </div>
        <Link
          href="/app/categories/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Añadir categoria
        </Link>
      </div>

      {/* ── Stats ── */}
      {!loading && categories.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Layers className="w-4.5 h-4.5 text-indigo-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{categories.length}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckSquare className="w-4.5 h-4.5 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs text-gray-400">Activas</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200/60">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
              <Square className="w-4.5 h-4.5 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{inactiveCount}</p>
              <p className="text-xs text-gray-400">Inactivas</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Search bar ── */}
      {!loading && categories.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {hasSelection && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200/60 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
            <CheckSquare className="w-4 h-4" />
            {selectedIds.size} seleccionada{selectedIds.size !== 1 ? "s" : ""}
          </div>
          <div className="h-4 w-px bg-indigo-200" />
          <button
            onClick={openDeleteBulk}
            className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar seleccionadas
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 transition"
          >
            Deseleccionar todo
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Productos</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Descripcion</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : categories.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
            <FolderOpen className="w-7 h-7 text-indigo-400" />
          </div>
          <h3 className="font-display font-semibold text-gray-900 text-lg mb-1.5">
            No hay categorias
          </h3>
          <p className="text-sm text-gray-400 max-w-sm mb-6">
            Las categorias te ayudan a organizar tus productos para que tus clientes encuentren lo que buscan mas rapido.
          </p>
          <Link
            href="/app/categories/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            Crear tu primera categoria
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        /* ── No search results ── */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="font-display font-semibold text-gray-900 mb-1">
            Sin resultados
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            No se encontraron categorias con &quot;{search}&quot;
          </p>
          <button
            onClick={() => setSearch("")}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition"
          >
            Limpiar busqueda
          </button>
        </div>
      ) : (
        /* ── Data table ── */
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="p-0.5 rounded hover:bg-gray-200/60 transition text-gray-400"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4.5 h-4.5 text-indigo-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Productos</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Estado</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase hidden md:table-cell">Descripcion</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const count = productCounts[c.id] ?? 0;
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors group ${
                      isSelected ? "bg-indigo-50/30" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleSelect(c.id)}
                        className={`p-0.5 rounded transition ${
                          isSelected
                            ? "text-indigo-600"
                            : "text-gray-300 opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4.5 h-4.5" />
                        ) : (
                          <Square className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </td>

                    {/* Name + slug */}
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/app/categories/${c.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600 transition text-sm"
                      >
                        {c.name}
                      </Link>
                      <span className="text-xs text-gray-400 mt-0.5 block truncate max-w-[200px]">
                        /{c.slug}
                      </span>
                    </td>

                    {/* Product count */}
                    <td className="px-4 py-3.5">
                      {count > 0 ? (
                        <Link
                          href={`/app/products?category=${c.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition"
                        >
                          <Package className="w-3 h-3" />
                          {count} producto{count !== 1 ? "s" : ""}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-300">Sin productos</span>
                      )}
                    </td>

                    {/* Status toggle */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        title={c.is_active ? "Click para desactivar" : "Click para activar"}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer hover:shadow-sm ${
                          c.is_active
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-150"
                        }`}
                      >
                        {c.is_active ? "Activa" : "Inactiva"}
                      </button>
                    </td>

                    {/* Description preview */}
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {c.description ? (
                        <span className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">
                          {c.description}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => router.push(`/app/categories/${c.id}`)}
                          className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteSingle(c.id, c.name)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Delete modal ── */}
      <ConfirmModal
        open={showDeleteModal}
        title={
          deleteTarget
            ? `Eliminar "${deleteTarget.name}"`
            : `Eliminar ${selectedIds.size} categoria${selectedIds.size !== 1 ? "s" : ""}`
        }
        message={
          deleteTarget
            ? "Los productos de esta categoria quedaran sin categoria asignada. Podras reasignarlos despues."
            : "Los productos de estas categorias quedaran sin categoria asignada. Podras reasignarlos despues."
        }
        count={deleteTarget ? undefined : selectedIds.size}
        confirmLabel={
          deleteTarget
            ? "Eliminar"
            : `Eliminar ${selectedIds.size}`
        }
        loading={bulkDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
