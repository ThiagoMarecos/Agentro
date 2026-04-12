"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { getCategory, updateCategory, deleteCategory, type Category } from "@/lib/api/categories";
import { ArrowLeft, Trash2 } from "lucide-react";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const inputClass = "w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-2";

export default function EditCategoryPage() {
  const { currentStore } = useStore();
  const params = useParams();
  const categoryId = params.id as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentStore || !categoryId) return;
    getCategory(currentStore.id, categoryId)
      .then((c) => { setCategory(c); setName(c.name); setSlug(c.slug); setDescription(c.description || ""); setSortOrder(String(c.sort_order ?? 0)); setIsActive(c.is_active ?? true); })
      .catch(() => setError("Error al cargar categoría"))
      .finally(() => setLoading(false));
  }, [currentStore, categoryId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !category) return;
    setError(""); setSaving(true);
    try {
      const updated = await updateCategory(currentStore.id, category.id, { name, slug, description: description || undefined, sort_order: parseInt(sortOrder, 10) || 0, is_active: isActive });
      setCategory(updated);
    } catch (err) { setError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!currentStore || !category) return;
    if (!confirm(`¿Eliminar "${category.name}"? Los productos quedarán sin categoría.`)) return;
    try { await deleteCategory(currentStore.id, category.id); window.location.href = "/app/categories"; }
    catch (err) { alert(err instanceof Error ? err.message : "Error al eliminar"); }
  };

  if (!currentStore) return <div className="text-gray-400">Selecciona una tienda</div>;
  if (loading) return <div className="py-12 text-center text-gray-400">Cargando...</div>;
  if (!category) return (
    <div>
      <Link href="/app/categories" className="text-gray-400 hover:text-gray-700 text-sm">← Volver</Link>
      <p className="mt-4 text-red-600">Categoría no encontrada</p>
    </div>
  );

  return (
    <div>
      <Link href="/app/categories" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Volver a categorías
      </Link>

      <div className="flex justify-between items-start mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">{category.name}</h1>
        <button onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition">
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">{error}</div>}

      <form onSubmit={handleSave} className="max-w-xl">
        <div className="bg-white rounded-xl border border-gray-200/60 p-6 space-y-4">
          <div><label className={labelClass}>Nombre *</label><input type="text" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} className={inputClass} required /></div>
          <div><label className={labelClass}>Slug *</label><input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Descripción</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} /></div>
          <div><label className={labelClass}>Orden</label><input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} /></div>
          <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="text-sm text-gray-700">Activa</span></label>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="px-6 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 transition text-sm">{saving ? "Guardando..." : "Guardar cambios"}</button>
          <Link href="/app/categories" className="px-6 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
