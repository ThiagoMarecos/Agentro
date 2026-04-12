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
import { EmptyState } from "@/components/ui/EmptyState";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Truck className="w-7 h-7 text-indigo-600" />
            Proveedores
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gestiona los proveedores de tu tienda
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        )}
      </div>

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
        <EmptyState
          title="No hay proveedores"
          description="Agrega tu primer proveedor para gestionar la cadena de suministro de tu tienda."
          action={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 transition"
            >
              <Plus className="w-4 h-4" /> Nuevo proveedor
            </button>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Proveedor
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Contacto
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Ubicación
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Estado
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {supplier.name}
                          </p>
                          {supplier.website && (
                            <a
                              href={supplier.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-500 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <Globe className="w-3 h-3" />
                              {supplier.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        {supplier.contact_name && (
                          <p className="text-gray-700 text-sm">
                            {supplier.contact_name}
                          </p>
                        )}
                        {supplier.email && (
                          <p className="text-gray-400 text-xs flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {supplier.email}
                          </p>
                        )}
                        {supplier.phone && (
                          <p className="text-gray-400 text-xs flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {supplier.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {(supplier.city || supplier.country) && (
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {[supplier.city, supplier.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          supplier.is_active
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {supplier.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(supplier)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supplier)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
