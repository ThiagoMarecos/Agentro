"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { createCategory } from "@/lib/api/categories";
import { ArrowLeft, FolderTree } from "lucide-react";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const inputClass = "w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-2";

export default function NewCategoryPage() {
  const { currentStore } = useStore();
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    setError(""); setLoading(true);
    try {
      await createCategory(currentStore.id, { name, slug: slug || slugify(name), description: description || undefined, sort_order: parseInt(sortOrder, 10) || 0, is_active: isActive });
      router.push("/app/categories");
    } catch (err) { setError(err instanceof Error ? err.message : "Error al crear categoría"); }
    finally { setLoading(false); }
  };

  if (!currentStore) return <div className="text-gray-400">Selecciona una tienda</div>;

  return (
    <div>
      <Link href="/app/categories" className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Volver a categorías
      </Link>
      <h1 className="text-2xl font-display font-bold text-gray-900 mb-2">Nueva categoría</h1>
      <p className="text-gray-400 text-sm mb-8">Crea una categoría para organizar tus productos.</p>

      {error && <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-xl">
        <div className="bg-white rounded-xl border border-gray-200/60 p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><FolderTree className="w-5 h-5" /></div>
            <h2 className="font-display font-semibold text-gray-900">Datos de la categoría</h2>
          </div>
          <div><label className={labelClass}>Nombre *</label><input type="text" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} className={inputClass} placeholder="Ej: Remeras" required /></div>
          <div><label className={labelClass}>Slug *</label><input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name) || "remeras"} className={inputClass} /></div>
          <div><label className={labelClass}>Descripción</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} placeholder="Descripción opcional" /></div>
          <div><label className={labelClass}>Orden</label><input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} /></div>
          <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="text-sm text-gray-700">Activa</span></label>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={loading} className="px-6 py-3 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50 transition text-sm">{loading ? "Creando..." : "Crear categoría"}</button>
          <Link href="/app/categories" className="px-6 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
