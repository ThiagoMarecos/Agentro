"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Shield,
  Store,
  AlertTriangle,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  ExternalLink,
  CheckCircle,
  LogOut,
} from "lucide-react";
import {
  getUserProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  logout as doLogout,
} from "@/lib/auth";
import { getStores, deleteStore, createStore } from "@/lib/api/stores";
import { useStore as useStoreContext } from "@/lib/context/StoreContext";
import { uploadImage } from "@/lib/api/products";
import { ImageUploader } from "@/components/ui/ImageUploader";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  auth_provider: string;
  is_verified: boolean;
  created_at: string | null;
}

interface StoreItem {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  logo_url?: string | null;
}

type Tab = "profile" | "security" | "stores" | "danger";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Perfil", icon: UserIcon },
  { id: "security", label: "Seguridad", icon: Shield },
  { id: "stores", label: "Mis tiendas", icon: Store },
  { id: "danger", label: "Zona de peligro", icon: AlertTriangle },
];

export default function AccountPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUserProfile(), getStores()])
      .then(([p, s]) => {
        setProfile(p);
        setStores(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  if (!profile) {
    return <div className="py-12 text-center text-gray-500">Error al cargar perfil</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-gray-900 mb-1">Mi cuenta</h1>
      <p className="text-sm text-gray-400 mb-8">Configuración de tu cuenta personal</p>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Sidebar tabs */}
        <nav className="sm:w-56 flex-shrink-0">
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
                  <Icon className={`w-4 h-4 ${active ? "text-indigo-500" : t.id === "danger" ? "" : "text-gray-400"}`} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === "profile" && (
            <ProfileTab profile={profile} onUpdate={setProfile} />
          )}
          {tab === "security" && <SecurityTab profile={profile} />}
          {tab === "stores" && (
            <StoresTab stores={stores} onStoresChange={setStores} />
          )}
          {tab === "danger" && <DangerTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (p: UserProfile) => void;
}) {
  const [name, setName] = useState(profile.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateProfile({
        full_name: name.trim() || undefined,
        avatar_url: avatarUrl || null,
      });
      onUpdate({ ...profile, ...updated });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    const result = await uploadImage(profile.id, file);
    return result;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Perfil</h2>
        <p className="text-sm text-gray-400">Tu información personal</p>
      </div>

      <ImageUploader
        label="Foto de perfil"
        value={avatarUrl || null}
        onChange={(url) => setAvatarUrl(url || "")}
        onUpload={handleUpload}
        shape="circle"
        previewSize="lg"
        hint="JPG, PNG. Máximo 5MB."
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
        <input
          value={profile.email}
          disabled
          className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor de autenticación</label>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium text-xs uppercase tracking-wide">
            {profile.auth_provider === "google" ? "Google" : "Email"}
          </div>
        </div>
      </div>

      {profile.created_at && (
        <p className="text-xs text-gray-400">
          Cuenta creada el {new Date(profile.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="w-4 h-4" /> Perfil actualizado
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar cambios
      </button>
    </div>
  );
}

function SecurityTab({ profile }: { profile: UserProfile }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isOAuth = profile.auth_provider !== "email";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (newPw.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await changePassword(currentPw, newPw);
      setSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Seguridad</h2>
      <p className="text-sm text-gray-400 mb-6">Gestión de contraseña</p>

      {isOAuth ? (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500">
          Tu cuenta está vinculada con <strong>{profile.auth_provider === "google" ? "Google" : profile.auth_provider}</strong>.
          No necesitás contraseña para iniciar sesión.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña actual</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nueva contraseña</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" /> Contraseña actualizada
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Cambiar contraseña
          </button>
        </form>
      )}
    </div>
  );
}

function StoresTab({
  stores,
  onStoresChange,
}: {
  stores: StoreItem[];
  onStoresChange: (s: StoreItem[]) => void;
}) {
  const storeContext = useStoreContext();
  const router = useRouter();

  /* ── Create store state ──────────────────────── */
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newLanguage, setNewLanguage] = useState("es");
  const [newIndustry, setNewIndustry] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  /* ── Delete store state ──────────────────────── */
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoreItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── Auto-generate slug from name ────────────── */
  const handleNameChange = (value: string) => {
    setNewName(value);
    const slug = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    setNewSlug(slug);
  };

  /* ── Create handler ──────────────────────────── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);

    try {
      const newStore = await createStore({
        name: newName.trim(),
        slug: newSlug.trim(),
        currency: newCurrency,
        language: newLanguage,
        industry: newIndustry || undefined,
        template_id: "minimal",
      });

      onStoresChange([...stores, newStore]);
      await storeContext.refresh();
      storeContext.setCurrentStore(newStore);

      setCreateSuccess(true);
      setNewName("");
      setNewSlug("");
      setNewIndustry("");

      setTimeout(() => {
        setShowCreate(false);
        setCreateSuccess(false);
      }, 1500);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  /* ── Delete handler ──────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget || confirmName !== deleteTarget.name) return;
    setDeleting(deleteTarget.id);
    setDeleteError(null);
    try {
      await deleteStore(deleteTarget.id);
      const updated = stores.filter((s) => s.id !== deleteTarget.id);
      onStoresChange(updated);
      await storeContext.refresh();
      setDeleteTarget(null);
      setConfirmName("");
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200/60 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mis tiendas</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {stores.length} tienda{stores.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> Nueva tienda
          </button>
        </div>

        {/* ── Create store form ──────────────────── */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-6 p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-4"
          >
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Crear nueva tienda
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Nombre de la tienda <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Mi tienda"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Slug (URL) <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center">
                  <span className="text-xs text-gray-400 mr-1.5">/store/</span>
                  <input
                    type="text"
                    value={newSlug}
                    onChange={(e) =>
                      setNewSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    placeholder="mi-tienda"
                    required
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Industria
                </label>
                <select
                  value={newIndustry}
                  onChange={(e) => setNewIndustry(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Seleccionar...</option>
                  <option value="fashion">Moda</option>
                  <option value="electronics">Electrónica</option>
                  <option value="food">Alimentos</option>
                  <option value="beauty">Belleza</option>
                  <option value="home">Hogar</option>
                  <option value="sports">Deportes</option>
                  <option value="toys">Juguetes</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Moneda
                </label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                  <option value="CLP">CLP</option>
                  <option value="MXN">MXN</option>
                  <option value="COP">COP</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Idioma
                </label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{createError}</p>
              </div>
            )}

            {createSuccess && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-700 font-medium">
                  Tienda creada exitosamente!
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim() || !newSlug.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Crear tienda
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ── Store list ─────────────────────────── */}
        {stores.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Store className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium mb-1">
              No tenes tiendas todavia
            </p>
            <p className="text-xs text-gray-400">
              Crea tu primera tienda para empezar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stores.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {s.logo_url ? (
                    <img
                      src={s.logo_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-5 h-5 text-indigo-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {s.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">/store/{s.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!s.is_active && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">
                      Suspendida
                    </span>
                  )}
                  <Link
                    href={`/store/${s.slug}`}
                    target="_blank"
                    className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => {
                      setDeleteTarget(s);
                      setConfirmName("");
                      setDeleteError(null);
                    }}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Eliminar tienda
            </h3>

            {deleteError && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    No se puede eliminar
                  </p>
                  <p className="text-sm text-amber-700">{deleteError}</p>
                  <Link
                    href="/app/orders"
                    className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Ir a pedidos
                  </Link>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-500 mb-4">
              Esto eliminara <strong>{deleteTarget.name}</strong> y todos sus
              datos (productos, pedidos, configuracion). Esta accion no se puede
              deshacer.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Escribi <strong>{deleteTarget.name}</strong> para confirmar:
            </p>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleteTarget.name}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={
                  confirmName !== deleteTarget.name ||
                  deleting === deleteTarget.id
                }
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Eliminar tienda"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerTab({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText !== "ELIMINAR") return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      doLogout();
      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200/60 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Cerrar sesión</h2>
        <p className="text-sm text-gray-400 mb-4">Cerrá tu sesión actual en este dispositivo.</p>
        <button
          onClick={() => {
            doLogout();
            router.push("/login");
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>

      <div className="bg-white rounded-xl border-2 border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-1">Eliminar cuenta</h2>
        <p className="text-sm text-gray-500 mb-4">
          Esto eliminará permanentemente tu cuenta, todas tus tiendas (si sos el único miembro)
          y todos los datos asociados. Esta acción no se puede deshacer.
        </p>
        <p className="text-sm text-gray-700 mb-2">
          Escribí <strong>ELIMINAR</strong> para confirmar:
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="ELIMINAR"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
        />
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 mb-1">No se puede eliminar</p>
              <p className="text-sm text-amber-700">{error}</p>
              <Link href="/app/orders" className="inline-block mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 underline">
                Ir a pedidos →
              </Link>
            </div>
          </div>
        )}
        <button
          onClick={handleDelete}
          disabled={confirmText !== "ELIMINAR" || deleting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Eliminar mi cuenta permanentemente
        </button>
      </div>
    </div>
  );
}
