"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import {
  getProducts,
  deleteProduct,
  duplicateProduct,
  bulkDeleteProducts,
  type ProductListItem,
  type ProductListParams,
} from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import type { Category } from "@/lib/api/categories";
import { formatPrice } from "@/lib/utils/formatPrice";
import {
  Plus, Search, Pencil, Copy, Trash2, Package,
  ChevronLeft, ChevronRight, SlidersHorizontal, X, Globe,
  CheckSquare, Square, MinusSquare, AlertTriangle,
} from "lucide-react";

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Sin stock</span>;
  if (qty <= 5)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">{qty} bajo</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">{qty}</span>;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="px-4 py-3.5 w-10"><div className="w-5 h-5 rounded bg-gray-100 animate-pulse" /></td>
      <td className="px-4 py-3.5"><div className="w-12 h-12 rounded-xl bg-gray-100 animate-pulse" /></td>
      <td className="px-4 py-3.5">
        <div className="h-4 w-36 bg-gray-100 rounded animate-pulse mb-1.5" />
        <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
      </td>
      <td className="px-4 py-3.5"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
      <td className="px-4 py-3.5"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
      <td className="px-4 py-3.5"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
      <td className="px-4 py-3.5"><div className="h-4 w-20 bg-gray-100 rounded animate-pulse" /></td>
      <td className="px-4 py-3.5"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
      <td className="px-4 py-3.5">
        <div className="flex gap-1 justify-end">
          {[1, 2, 3].map((i) => <div key={i} className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </td>
    </tr>
  );
}

/* ── Confirmation Modal ── */
function ConfirmModal({
  open,
  title,
  message,
  count,
  confirmLabel,
  confirmColor = "red",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  count: number;
  confirmLabel: string;
  confirmColor?: "red" | "indigo";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const colorClasses =
    confirmColor === "red"
      ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
                <Trash2 className="w-3.5 h-3.5" />
                {count} producto{count !== 1 ? "s" : ""} seleccionado{count !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition disabled:opacity-60 flex items-center gap-2 ${colorClasses}`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Eliminando...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { currentStore } = useStore();
  const router = useRouter();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [skip, setSkip] = useState(0);
  const limit = 20;

  // ── Selection state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!currentStore) return;
    setLoading(true);
    setError("");
    try {
      const params: ProductListParams = { skip, limit };
      if (searchDebounced) params.search = searchDebounced;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category_id = categoryFilter;
      const res = await getProducts(currentStore.id, params);
      setProducts(res.items);
      setTotal(res.total);
    } catch {
      setProducts([]);
      setError("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, [currentStore, skip, searchDebounced, statusFilter, categoryFilter]);

  const fetchCategories = useCallback(async () => {
    if (!currentStore) return;
    try {
      const cats = await getCategories(currentStore.id);
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  }, [currentStore]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setSkip(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Clear selection when products change (page change, filter, etc.)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [products]);

  // ── Selection handlers ──
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const isAllSelected = products.length > 0 && selectedIds.size === products.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < products.length;

  // ── Action handlers ──
  const handleDelete = async (id: string, name: string) => {
    if (!currentStore) return;
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteProduct(currentStore.id, id);
      fetchProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!currentStore) return;
    try {
      const product = products.find((p) => p.id === id);
      const baseSlug = product?.slug || "copia";
      const newSlug = `${baseSlug}-copia-${Date.now().toString(36)}`;
      await duplicateProduct(currentStore.id, id, newSlug);
      fetchProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al duplicar");
    }
  };

  const handleBulkDelete = async () => {
    if (!currentStore || selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const result = await bulkDeleteProducts(currentStore.id, Array.from(selectedIds));
      setShowDeleteModal(false);
      setSelectedIds(new Set());
      if (result.errors.length > 0) {
        setError(`Se eliminaron ${result.deleted_count} productos. ${result.errors.length} no se pudieron eliminar.`);
      }
      fetchProducts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar productos");
    } finally {
      setBulkDeleting(false);
    }
  };

  if (!currentStore) {
    return <div className="animate-pulse text-gray-400">Selecciona una tienda</div>;
  }

  const hasFilters = !!(search || statusFilter || categoryFilter);
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasSelection = selectedIds.size > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading
              ? "Cargando catálogo..."
              : total === 0
              ? "Tu catálogo está vacío"
              : `${total} producto${total !== 1 ? "s" : ""} en tu catálogo`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/products/import-from-url"
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition"
          >
            <Globe className="w-4 h-4 text-gray-500" />
            Importar de otro sitio
          </Link>
          <Link
            href="/app/products/new"
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" />
            Añadir producto
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
        </div>
        <div className="relative">
          <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
            className="pl-9 pr-8 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none appearance-none"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="archived">Archivado</option>
          </select>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setSkip(0); }}
          className="px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); setSkip(0); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Bulk Action Bar ── */}
      {hasSelection && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200/60 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
            <CheckSquare className="w-4 h-4" />
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
          </div>
          <div className="h-4 w-px bg-indigo-200" />
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition shadow-sm shadow-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar seleccionados
          </button>
          <div className="ml-auto">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-600 hover:bg-indigo-100 transition"
            >
              <X className="w-3.5 h-3.5" />
              Deseleccionar todo
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200/60 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {/* Checkbox header */}
              <th className="px-4 py-3 w-10">
                {products.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-indigo-600 transition"
                    title={isAllSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                )}
              </th>
              <th className="px-4 py-3 text-left w-16" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Precio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Actualizado</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <Package className="w-8 h-8 text-indigo-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {hasFilters ? "Sin resultados para tu búsqueda" : "Todavía no hay productos"}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {hasFilters
                          ? "Probá con otros filtros o limpialos para ver todo."
                          : "Añadí tu primer producto para comenzar a vender."}
                      </p>
                    </div>
                    {!hasFilters && (
                      <Link
                        href="/app/products/new"
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir producto
                      </Link>
                    )}
                    {hasFilters && (
                      <button
                        onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); setSkip(0); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                      >
                        <X className="w-4 h-4" /> Limpiar filtros
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors group ${
                      isSelected ? "bg-indigo-50/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleSelect(p.id)}
                        className="text-gray-400 hover:text-indigo-600 transition"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                        {p.cover_image_url ? (
                          <img src={p.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/app/products/${p.id}`}
                        className="font-medium text-gray-900 hover:text-indigo-600 transition block"
                      >
                        {p.name}
                      </Link>
                      {p.slug && (
                        <span className="text-xs text-gray-400 mt-0.5 block truncate max-w-[200px]">/{p.slug}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <ProductStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800">{formatPrice(Number(p.price), currentStore?.currency)}</td>
                    <td className="px-4 py-3.5">
                      <StockBadge qty={p.stock_quantity ?? 0} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {p.category_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs">
                      {p.updated_at
                        ? new Date(p.updated_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => router.push(`/app/products/${p.id}`)}
                          className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition"
                          title="Editar producto"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(p.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
                          title="Duplicar producto"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex justify-between items-center text-sm">
          <span className="text-gray-400">
            Mostrando {skip + 1}–{Math.min(skip + limit, total)} de {total} productos
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSkip((s) => Math.max(0, s - limit))}
              disabled={skip === 0}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition text-gray-600"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-semibold text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setSkip((s) => s + limit)}
              disabled={skip + limit >= total}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition text-gray-600"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        title="Eliminar productos"
        message="¿Estás seguro de que querés eliminar los productos seleccionados? Esta acción eliminará permanentemente los productos y todas sus imágenes, variantes y datos asociados. No se puede deshacer."
        count={selectedIds.size}
        confirmLabel={`Eliminar ${selectedIds.size} producto${selectedIds.size !== 1 ? "s" : ""}`}
        confirmColor="red"
        loading={bulkDeleting}
        onConfirm={handleBulkDelete}
        onCancel={() => { if (!bulkDeleting) setShowDeleteModal(false); }}
      />
    </div>
  );
}
