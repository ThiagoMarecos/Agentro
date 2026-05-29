"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/context/StoreContext";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type Supplier,
  type SupplierCreate,
} from "@/lib/api/suppliers";
import {
  Truck,
  Plus,
  Trash2,
  X,
  Loader2,
  Pencil,
  Globe,
  Phone,
  Mail,
  MapPin,
  Check,
  Search,
  Building2,
  ExternalLink,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-3 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

const emptyForm: SupplierCreate = {
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  website: "",
  notes: "",
  is_active: true,
};

export default function SuppliersPage() {
  const { currentStore } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierCreate>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const fetchSuppliers = async () => {
    if (!currentStore) return;
    setLoading(true);
    try {
      const data = await getSuppliers(currentStore.id);
      setSuppliers(data);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [currentStore]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setError("");
    setShowForm(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      website: supplier.website || "",
      notes: supplier.notes || "",
      is_active: supplier.is_active,
    });
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore || !form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateSupplier(currentStore.id, editing.id, form);
      } else {
        await createSupplier(currentStore.id, form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ ...emptyForm });
      await fetchSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!currentStore) return;
    if (!confirm(`¿Eliminar el proveedor "${supplier.name}"?`)) return;
    try {
      await deleteSupplier(currentStore.id, supplier.id);
      await fetchSuppliers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const updateField = (field: keyof SupplierCreate, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (!currentStore) {
    return <div className="text-gray-400">Selecciona una tienda</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const activeCount = suppliers.filter((s) => s.is_active).length;
  const inactiveCount = suppliers.length - activeCount;
  const filtered = suppliers.filter((s) => {
    if (filter === "active" && !s.is_active) return false;
    if (filter === "inactive" && s.is_active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-500 mb-1.5">
            CADENA DE SUMINISTRO
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-900 flex items-center gap-2.5">
            <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/30">
              <Truck className="w-4.5 h-4.5" />
            </span>
            Proveedores
          </h1>
          <p className="text-gray-500 text-sm mt-1.5 max-w-xl">
            Catálogo de proveedores con sus datos de contacto y ubicación. Asociá productos a proveedores
            para hacer seguimiento de stock y reposición.
          </p>
        </div>
        {!showForm && suppliers.length > 0 && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        )}
      </div>

      {/* ── Stats cards ── */}
      {suppliers.length > 0 && !showForm && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200/60">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{suppliers.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200/60">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{activeCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Activos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200/60">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <X className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{inactiveCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Inactivos</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Filtros + búsqueda ── */}
      {suppliers.length > 0 && !showForm && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, contacto, email o ciudad..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            />
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filter === f
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900 text-lg">
              {editing ? "Editar proveedor" : "Nuevo proveedor"}
            </h3>
            <button
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nombre del proveedor *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className={inputClass}
                  placeholder="Ej: Distribuidora XYZ"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Nombre de contacto</label>
                <input
                  type="text"
                  value={form.contact_name || ""}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  className={inputClass}
                  placeholder="Persona de contacto"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  className={inputClass}
                  placeholder="proveedor@ejemplo.com"
                />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input
                  type="text"
                  value={form.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className={inputClass}
                  placeholder="+1 234 567 890"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Dirección</label>
              <input
                type="text"
                value={form.address || ""}
                onChange={(e) => updateField("address", e.target.value)}
                className={inputClass}
                placeholder="Calle, número, etc."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Ciudad</label>
                <input
                  type="text"
                  value={form.city || ""}
                  onChange={(e) => updateField("city", e.target.value)}
                  className={inputClass}
                  placeholder="Ciudad"
                />
              </div>
              <div>
                <label className={labelClass}>País</label>
                <input
                  type="text"
                  value={form.country || ""}
                  onChange={(e) => updateField("country", e.target.value)}
                  className={inputClass}
                  placeholder="País"
                />
              </div>
              <div>
                <label className={labelClass}>Sitio web</label>
                <input
                  type="text"
                  value={form.website || ""}
                  onChange={(e) => updateField("website", e.target.value)}
                  className={inputClass}
                  placeholder="https://ejemplo.com"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notas</label>
              <textarea
                value={form.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Notas sobre el proveedor..."
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={(e) => updateField("is_active", e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Proveedor activo</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {saving
                  ? "Guardando..."
                  : editing
                  ? "Guardar cambios"
                  : "Crear proveedor"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {suppliers.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
            <Truck className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Todavía no hay proveedores
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Agregá tus proveedores para mantener su contacto a mano y poder asociarlos a tus productos
            para reposición de stock.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" /> Crear primer proveedor
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Sin resultados para tu búsqueda</p>
          <button
            onClick={() => { setSearch(""); setFilter("all"); }}
            className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((supplier) => (
            <div
              key={supplier.id}
              className={`group relative rounded-2xl bg-white border p-5 transition-all hover:shadow-md hover:border-indigo-200 ${
                supplier.is_active ? "border-gray-200/60" : "border-gray-200/60 opacity-70"
              }`}
            >
              {/* Status dot */}
              <span
                className={`absolute top-4 right-4 w-2 h-2 rounded-full ${
                  supplier.is_active ? "bg-emerald-500" : "bg-gray-300"
                }`}
                title={supplier.is_active ? "Activo" : "Inactivo"}
              />

              {/* Header */}
              <div className="flex items-start gap-3 mb-4 pr-6">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/30">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 leading-tight truncate">
                    {supplier.name}
                  </h3>
                  {supplier.contact_name && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {supplier.contact_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Datos de contacto */}
              <div className="space-y-1.5 mb-4 min-h-[68px]">
                {supplier.email && (
                  <a
                    href={`mailto:${supplier.email}`}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-indigo-600 transition truncate"
                  >
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{supplier.email}</span>
                  </a>
                )}
                {supplier.phone && (
                  <a
                    href={`tel:${supplier.phone}`}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-indigo-600 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {supplier.phone}
                  </a>
                )}
                {(supplier.city || supplier.country) && (
                  <p className="flex items-center gap-2 text-xs text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {[supplier.city, supplier.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {supplier.website && (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 transition truncate"
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{supplier.website.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                  </a>
                )}
                {!supplier.email && !supplier.phone && !supplier.city && !supplier.website && (
                  <p className="text-xs text-gray-400 italic">Sin datos de contacto</p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => openEdit(supplier)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <div className="w-px h-4 bg-gray-200" />
                <button
                  onClick={() => handleDelete(supplier)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
