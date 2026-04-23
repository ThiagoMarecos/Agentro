"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { getCategories } from "@/lib/api/categories";
import {
  getProduct, updateProduct, deleteProduct, duplicateProduct,
  uploadImage, addProductImage, deleteProductImage,
  type Product,
} from "@/lib/api/products";
import type { Category } from "@/lib/api/categories";
import { getSuppliers, type Supplier } from "@/lib/api/suppliers";
import {
  ArrowLeft, Copy, Trash2, Loader2, Package,
  DollarSign, Archive, Layers, Globe, ImageIcon,
  Upload, Star, CheckCircle, Truck, Lock,
} from "lucide-react";

const ORIGIN_TYPES: { value: string; label: string }[] = [
  { value: "external_supplier", label: "Proveedor externo" },
  { value: "own_manufacturing", label: "Fabricación propia" },
  { value: "dropshipping", label: "Dropshipping" },
  { value: "imported", label: "Importado" },
];
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

function SectionCard({
  icon, iconBg, iconColor, title, subtitle, children,
}: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <div>
          <h2 className="font-display font-semibold text-gray-900 text-sm">{title}</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="h-4 w-36 bg-gray-100 rounded animate-pulse mb-6" />
      <div className="flex gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gray-100 animate-pulse" />
        <div>
          <div className="h-6 w-52 bg-gray-100 rounded animate-pulse mb-2" />
          <div className="h-4 w-24 bg-gray-50 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-52 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="space-y-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}

export default function EditProductPage() {
  const { currentStore } = useStore();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("active");
  const [isFeatured, setIsFeatured] = useState(false);
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [cost, setCost] = useState("");
  const [sku, setSku] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [stockQuantity, setStockQuantity] = useState("0");
  const [allowBackorder, setAllowBackorder] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  // Origen y proveedor
  const [supplierId, setSupplierId] = useState<string>("");
  const [originType, setOriginType] = useState<string>("external_supplier");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentStore || !productId) return;
    getProduct(currentStore.id, productId)
      .then((p) => {
        setProduct(p);
        setName(p.name);
        setSlug(p.slug);
        setShortDescription(p.short_description || "");
        setDescription(p.description || "");
        setCategoryId(p.category_id || "");
        setStatus(p.status || "active");
        setIsFeatured(p.is_featured || false);
        setPrice(p.price || "");
        setCompareAtPrice(p.compare_at_price || "");
        setCost(p.cost || "");
        setSku(p.sku || "");
        setTrackInventory(p.track_inventory ?? true);
        setStockQuantity(String(p.stock_quantity ?? 0));
        setAllowBackorder(p.allow_backorder || false);
        setSeoTitle(p.seo_title || "");
        setSeoDescription(p.seo_description || "");
        setSupplierId(p.supplier_id || "");
        setOriginType(p.origin_type || "external_supplier");
        setLeadTimeDays(p.lead_time_days != null ? String(p.lead_time_days) : "");
        setInternalNotes(p.internal_notes || "");
      })
      .catch(() => setError("Error al cargar el producto"))
      .finally(() => setLoading(false));
  }, [currentStore, productId]);

  useEffect(() => {
    if (!currentStore) return;
    getCategories(currentStore.id).then(setCategories).catch(() => setCategories([]));
    getSuppliers(currentStore.id).then(setSuppliers).catch(() => setSuppliers([]));
  }, [currentStore]);

  const handleSave = async () => {
    if (!currentStore || !product) return;
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      await updateProduct(currentStore.id, product.id, {
        name, slug,
        short_description: shortDescription || undefined,
        description: description || undefined,
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        origin_type: originType || "external_supplier",
        lead_time_days: leadTimeDays ? parseInt(leadTimeDays, 10) : null,
        internal_notes: internalNotes || undefined,
        status,
        is_featured: isFeatured,
        price: parseFloat(price) || 0,
        compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null,
        cost: cost ? parseFloat(cost) : null,
        sku: sku || undefined,
        track_inventory: trackInventory,
        stock_quantity: parseInt(stockQuantity, 10) || 0,
        allow_backorder: allowBackorder,
        seo_title: seoTitle || undefined,
        seo_description: seoDescription || undefined,
      });
      const updated = await getProduct(currentStore.id, product.id);
      setProduct(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentStore || !product) return;
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteProduct(currentStore.id, product.id);
      router.push("/app/products");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const handleDuplicate = async () => {
    if (!currentStore || !product) return;
    try {
      await duplicateProduct(currentStore.id, product.id, `${product.slug}-copia-${Date.now().toString(36)}`);
      router.push("/app/products");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al duplicar");
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!currentStore || !product) return;
    setUploadingImage(true);
    try {
      const { url } = await uploadImage(currentStore.id, file);
      await addProductImage(currentStore.id, product.id, {
        url,
        sort_order: product.images?.length ?? 0,
        is_cover: !(product.images && product.images.length > 0),
      });
      const updated = await getProduct(currentStore.id, product.id);
      setProduct(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploadingImage(false);
    }
  };

  if (!currentStore) return <div className="text-gray-400">Selecciona una tienda</div>;
  if (loading) return <LoadingSkeleton />;
  if (!product) return (
    <div>
      <Link href="/app/products" className="text-gray-400 hover:text-gray-700 text-sm">← Volver a productos</Link>
      <p className="mt-4 text-red-600 text-sm">{error || "Producto no encontrado"}</p>
    </div>
  );

  const discountPct =
    compareAtPrice && price && parseFloat(compareAtPrice) > parseFloat(price)
      ? Math.round((1 - parseFloat(price) / parseFloat(compareAtPrice)) * 100)
      : null;

  return (
    <div>
      <Link
        href="/app/products"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a productos
      </Link>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {product.cover_image_url ? (
            <img
              src={product.cover_image_url}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-indigo-300" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-display font-bold text-gray-900 truncate">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ProductStatusBadge status={product.status} />
              {product.is_featured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600 font-medium">
                  <Star className="w-3 h-3" /> Destacado
                </span>
              )}
              {product.has_variants && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-600 font-medium">
                  <Layers className="w-3 h-3" /> Con variantes
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <button
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
          >
            <Copy className="w-4 h-4" /> Duplicar
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 transition"
          >
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* General */}
          <SectionCard
            icon={<Package className="w-4 h-4" />}
            iconBg="bg-indigo-50" iconColor="text-indigo-600"
            title="Información general"
            subtitle="Nombre y descripción del producto"
          >
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nombre</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  Slug (URL)
                  <span className="ml-2 text-xs text-gray-400 font-normal">— identificador único en la URL</span>
                </label>
                <div className="flex">
                  <span className="px-3 py-2.5 text-xs text-gray-400 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg shrink-0 flex items-center">
                    /producto/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className={`${inputClass} rounded-l-none`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Descripción corta
                  <span className="ml-2 text-xs text-gray-400 font-normal">— aparece en listados</span>
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Una línea que resume el producto"
                />
              </div>
              <div>
                <label className={labelClass}>Descripción completa</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder="Materiales, talles, instrucciones de uso…"
                />
              </div>
            </div>
          </SectionCard>

          {/* Pricing */}
          <SectionCard
            icon={<DollarSign className="w-4 h-4" />}
            iconBg="bg-green-50" iconColor="text-green-600"
            title="Precios"
            subtitle="Precio de venta, descuento y costo interno"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Precio de venta</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Precio tachado
                  <span className="ml-1 text-xs text-gray-400 font-normal">— descuento</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    className={`${inputClass} pl-7`}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>
                  Costo
                  <span className="ml-1 text-xs text-gray-400 font-normal">— uso interno</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className={`${inputClass} pl-7`}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            {discountPct !== null && (
              <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-100 text-xs text-green-700">
                Se mostrará un <strong>{discountPct}% de descuento</strong> en la tienda.
              </div>
            )}
          </SectionCard>

          {/* Inventory */}
          <SectionCard
            icon={<Archive className="w-4 h-4" />}
            iconBg="bg-amber-50" iconColor="text-amber-600"
            title="Inventario"
            subtitle="Control de stock y código interno"
          >
            <div className="space-y-4">
              <div>
                <label className={labelClass}>SKU</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className={inputClass}
                  placeholder="Código interno del producto"
                />
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackInventory}
                    onChange={(e) => setTrackInventory(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Rastrear inventario</span>
                    <p className="text-xs text-gray-400 mt-0.5">Agentro llevará la cuenta del stock disponible</p>
                  </div>
                </label>
                {trackInventory && !product.has_variants && (
                  <div className="pl-7">
                    <label className={labelClass}>Cantidad en stock</label>
                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className={`${inputClass} max-w-[140px]`}
                    />
                  </div>
                )}
                {trackInventory && product.has_variants && (
                  <p className="pl-7 text-xs text-gray-400">El stock se gestiona por cada variante individualmente.</p>
                )}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowBackorder}
                    onChange={(e) => setAllowBackorder(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Permitir pedidos sin stock</span>
                    <p className="text-xs text-gray-400 mt-0.5">Los clientes podrán comprar aunque no haya unidades disponibles</p>
                  </div>
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Origen y proveedor */}
          <SectionCard
            icon={<Truck className="w-4 h-4" />}
            iconBg="bg-sky-50" iconColor="text-sky-600"
            title="Origen y proveedor"
            subtitle="De dónde viene el producto. Solo el agente IA usa esta info, el cliente no la ve."
          >
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Tipo de origen</label>
                <select
                  value={originType}
                  onChange={(e) => setOriginType(e.target.value)}
                  className={inputClass}
                >
                  {ORIGIN_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  Proveedor
                  <span className="ml-2 text-xs text-gray-400 font-normal">— opcional</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Sin proveedor asignado</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.country ? ` — ${s.country}` : ""}
                    </option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Aún no tenés proveedores cargados.{" "}
                    <Link href="/app/suppliers" className="text-indigo-600 hover:underline">Crear uno</Link>.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  Tiempo de reposición / entrega
                  <span className="ml-2 text-xs text-gray-400 font-normal">— días estimados</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    value={leadTimeDays}
                    onChange={(e) => setLeadTimeDays(e.target.value)}
                    className={`${inputClass} max-w-[160px]`}
                    placeholder="Ej: 7"
                  />
                  <span className="text-sm text-gray-400">días desde el pedido</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  El agente lo menciona si el cliente pregunta &ldquo;¿cuándo llega?&rdquo;.
                </p>
              </div>

              <div>
                <label className={labelClass}>
                  Notas internas para el agente
                  <Lock className="inline-block w-3 h-3 ml-1 text-gray-400" />
                  <span className="ml-2 text-xs text-gray-400 font-normal">— solo el agente las ve</span>
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  className={inputClass}
                  placeholder={"Ej:\n- Vende mejor con público joven\n- Garantía de 6 meses por defectos de fábrica\n- No ofrecer descuento mayor al 10%"}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Información privada que ayuda al agente a responder mejor. <strong>Nunca se cita literalmente al cliente.</strong>
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Variants — read only */}
          {product.has_variants && (
            <SectionCard
              icon={<Layers className="w-4 h-4" />}
              iconBg="bg-violet-50" iconColor="text-violet-600"
              title="Variantes"
              subtitle="Opciones disponibles del producto"
            >
              {product.variants && product.variants.length > 0 ? (
                <div className="space-y-2">
                  {product.variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm">{v.name}</span>
                        {v.sku && (
                          <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">
                            SKU: {v.sku}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-semibold text-gray-700">${v.price}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            (v.stock_quantity ?? 0) === 0
                              ? "bg-red-50 text-red-600"
                              : (v.stock_quantity ?? 0) <= 5
                              ? "bg-amber-50 text-amber-700"
                              : "bg-green-50 text-green-700"
                          }`}
                        >
                          {(v.stock_quantity ?? 0) === 0 ? "Sin stock" : `${v.stock_quantity} uds.`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Sin variantes registradas.</p>
              )}
            </SectionCard>
          )}

          {/* SEO */}
          <SectionCard
            icon={<Globe className="w-4 h-4" />}
            iconBg="bg-gray-100" iconColor="text-gray-500"
            title="SEO"
            subtitle="Cómo aparece este producto en Google"
          >
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Título para Google
                  <span className="ml-2 text-xs text-gray-400 font-normal">— máx. 60 caracteres</span>
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Si está vacío se usa el nombre del producto"
                  maxLength={60}
                />
                {seoTitle && (
                  <p className={`mt-1 text-xs ${seoTitle.length > 55 ? "text-amber-500" : "text-gray-400"}`}>
                    {seoTitle.length}/60 caracteres
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>
                  Descripción para Google
                  <span className="ml-2 text-xs text-gray-400 font-normal">— máx. 160 caracteres</span>
                </label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Descripción que aparece bajo el título en los resultados de búsqueda"
                  maxLength={160}
                />
                {seoDescription && (
                  <p className={`mt-1 text-xs ${seoDescription.length > 150 ? "text-amber-500" : "text-gray-400"}`}>
                    {seoDescription.length}/160 caracteres
                  </p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">

          {/* Save */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-5 space-y-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              ) : saved ? (
                <><CheckCircle className="w-4 h-4" /> Guardado</>
              ) : (
                "Guardar cambios"
              )}
            </button>
            {saved && (
              <p className="text-xs text-green-600 text-center">Los cambios se guardaron correctamente.</p>
            )}
            <Link
              href="/app/products"
              className="block w-full py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium text-center"
            >
              Cancelar
            </Link>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">Imágenes</h3>
              </div>
              {product.images && product.images.length > 0 && (
                <span className="text-xs text-gray-400">
                  {product.images.length} imagen{product.images.length !== 1 ? "es" : ""}
                </span>
              )}
            </div>

            {product.images && product.images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {product.images.map((img) => (
                  <div
                    key={img.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 group"
                  >
                    <img src={img.url} alt={img.alt_text || ""} className="w-full h-full object-cover" />
                    {img.is_cover && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-600 text-white font-medium leading-none">
                        Portada
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!currentStore || !confirm("¿Eliminar esta imagen?")) return;
                        setDeletingImageId(img.id);
                        try {
                          await deleteProductImage(currentStore.id, product.id, img.id);
                          const updated = await getProduct(currentStore.id, product.id);
                          setProduct(updated);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Error al eliminar imagen");
                        } finally {
                          setDeletingImageId(null);
                        }
                      }}
                      disabled={deletingImageId === img.id}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center disabled:opacity-50"
                      title="Eliminar imagen"
                    >
                      {deletingImageId === img.id
                        ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                        : <Trash2 className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mb-3">
                Sin imágenes todavía. Subí al menos una para que el producto se vea mejor.
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                await handleImageUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-full py-3.5 rounded-lg border-2 border-dashed border-gray-200 text-gray-400 text-sm hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/40 transition flex flex-col items-center gap-1.5 disabled:opacity-50"
            >
              {uploadingImage ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Subiendo imagen...</span></>
              ) : (
                <><Upload className="w-5 h-5" /><span className="font-medium">Subir imagen</span><span className="text-xs">jpg, png, gif, webp · máx 5MB</span></>
              )}
            </button>
          </div>

          {/* Quick settings */}
          <div className="bg-white rounded-xl border border-gray-200/60 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Configuración</h3>

            <div>
              <label className={labelClass}>Estado</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                <option value="active">Activo — visible en la tienda</option>
                <option value="draft">Borrador — guardado, no visible</option>
                <option value="archived">Archivado — oculto permanentemente</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Categoría</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100/60 transition">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Producto destacado
                </span>
                <p className="text-xs text-amber-600 mt-0.5">Se mostrará en la sección de destacados de tu tienda</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
