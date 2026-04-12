"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/context/StoreContext";
import { getCategories } from "@/lib/api/categories";
import { createProduct, uploadImage } from "@/lib/api/products";
import type { Category } from "@/lib/api/categories";
import {
  Plus, Trash2, ArrowLeft, Package, DollarSign,
  Archive, Layers, Globe, Upload, Star, X, ImageIcon,
  Sparkles, Loader2, ExternalLink, Save, AlertTriangle,
  Search,
} from "lucide-react";
import { aiPrefillProduct } from "@/lib/api/products";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const inputClass =
  "w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

type Tab = "general" | "pricing" | "inventory" | "images" | "variants" | "seo";

const TABS: { id: Tab; label: string; icon: React.ElementType; subtitle: string }[] = [
  { id: "general", label: "General", icon: Package, subtitle: "Nombre y descripci\u00f3n" },
  { id: "pricing", label: "Precios", icon: DollarSign, subtitle: "Precio, descuento y costo" },
  { id: "inventory", label: "Inventario", icon: Archive, subtitle: "Stock y c\u00f3digo SKU" },
  { id: "images", label: "Im\u00e1genes", icon: ImageIcon, subtitle: "Fotos del producto" },
  { id: "variants", label: "Variantes", icon: Layers, subtitle: "Tallas, colores, etc." },
  { id: "seo", label: "SEO", icon: Search, subtitle: "Posicionamiento en Google" },
];

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/60 p-6">
      <h2 className="font-display font-semibold text-gray-900 text-base">{title}</h2>
      <p className="text-xs text-gray-400 mb-5">{desc}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function NewProductPage() {
  const { currentStore } = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("general");

  // Fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState<"simple" | "variant">("simple");
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
  const [images, setImages] = useState<{ url: string; alt: string; isCover: boolean; file?: File; fromAi?: boolean }[]>([]);
  const [variants, setVariants] = useState<{ name: string; sku: string; price: string; stock: string }[]>([
    { name: "", sku: "", price: "", stock: "0" },
  ]);

  // IA prefill
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiStep, setAiStep] = useState<"idle" | "thinking" | "images" | "done">("idle");
  const [aiFilled, setAiFilled] = useState(false);

  useEffect(() => {
    if (!currentStore) return;
    getCategories(currentStore.id).then(setCategories).catch(() => setCategories([]));
  }, [currentStore]);

  // Check sessionStorage for data imported from external URL
  useEffect(() => {
    const raw = sessionStorage.getItem("nexora_import_product");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      sessionStorage.removeItem("nexora_import_product");
      if (data.name) setName(data.name);
      if (data.name) { setSlug(slugify(data.name)); setSlugManuallyEdited(true); }
      if (data.description) setDescription(data.description);
      if (data.price) setPrice(String(data.price));
      if (data.compare_at_price) setCompareAtPrice(String(data.compare_at_price));
      if (data.sku) setSku(data.sku);
      if (Array.isArray(data.image_urls) && data.image_urls.length > 0) {
        setImages(
          data.image_urls.slice(0, 5).map((url: string, i: number) => ({
            url,
            alt: data.name || "",
            isCover: i === 0,
          }))
        );
      }
    } catch { /* ignore malformed data */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (name && !slugManuallyEdited) setSlug(slugify(name));
  }, [name, slugManuallyEdited]);

  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files).map((file, i) => ({
      url: "",
      alt: "",
      isCover: images.length === 0 && i === 0,
      file,
    }));
    setImages((prev) => [...prev, ...newImages]);
  };

  const handleAiFill = async () => {
    if (!currentStore || !aiPrompt.trim()) return;
    setAiError("");
    setAiLoading(true);
    setAiStep("thinking");
    try {
      setAiStep("images");
      const result = await aiPrefillProduct(currentStore.id, aiPrompt.trim());

      setName(result.name);
      setSlug(result.slug);
      setSlugManuallyEdited(true);
      setShortDescription(result.short_description || "");
      setDescription(result.description || "");
      setPrice(String(result.price || ""));
      setCompareAtPrice(result.compare_at_price ? String(result.compare_at_price) : "");
      setSku(result.sku || "");
      setCategoryId(result.category_id || "");
      setSeoTitle(result.seo_title || "");
      setSeoDescription(result.seo_description || "");

      if (result.images && result.images.length > 0) {
        setImages(
          result.images.map((img) => ({
            url: img.url,
            alt: img.alt || result.name,
            isCover: img.is_cover,
            fromAi: true,
          }))
        );
      }

      setAiFilled(true);
      setAiStep("done");
      setAiModalOpen(false);
      setAiPrompt("");
      setAiStep("idle");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Error al generar el producto");
      setAiStep("idle");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    setError("");
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        slug: slug || slugify(name),
        short_description: shortDescription || undefined,
        description: description || undefined,
        category_id: categoryId || null,
        product_type: productType,
        status,
        has_variants: productType === "variant",
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
        is_active: status === "active",
        variants: [],
        images: [],
      };

      if (productType === "variant") {
        payload.variants = variants
          .filter((v) => v.name.trim())
          .map((v) => ({
            name: v.name,
            sku: v.sku || undefined,
            price: parseFloat(v.price) || 0,
            stock_quantity: parseInt(v.stock, 10) || 0,
          }));
        if ((payload.variants as unknown[]).length === 0) {
          setError("A\u00f1ad\u00ed al menos una variante con nombre.");
          setLoading(false);
          return;
        }
      }

      const imagePayloads = await Promise.all(
        images.map(async (img, idx) => {
          let url = img.url;
          if (img.file && currentStore) {
            const res = await uploadImage(currentStore.id, img.file);
            url = res.url;
          }
          return { url, alt_text: img.alt || undefined, sort_order: idx, is_cover: img.isCover };
        })
      );
      payload.images = imagePayloads.filter((i) => i.url);

      await createProduct(currentStore.id, payload as Parameters<typeof createProduct>[1]);
      router.push("/app/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear producto");
    } finally {
      setLoading(false);
    }
  };

  if (!currentStore) return <div className="text-gray-400">Seleccion\u00e1 una tienda</div>;

  const discountPct =
    compareAtPrice && price && parseFloat(compareAtPrice) > parseFloat(price)
      ? Math.round((1 - parseFloat(price) / parseFloat(compareAtPrice)) * 100)
      : null;

  const hasAiImages = images.some((img) => img.fromAi);

  return (
    <div>
      {/* Header */}
      <Link
        href="/app/products"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a productos
      </Link>

      <div className="flex items-start justify-between mb-7 gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Nuevo producto</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Complet\u00e1 los datos del producto. Los campos con <span className="text-red-400">*</span> son obligatorios.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/app/products/import-from-url"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
            Importar de URL
          </Link>
          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:from-indigo-600 hover:to-violet-600 transition shadow-sm shadow-indigo-500/25"
          >
            <Sparkles className="w-4 h-4" />
            Rellenar con IA
          </button>
        </div>
      </div>

      {/* AI filled notice */}
      {aiFilled && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Contenido generado por IA</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Todo fue generado por inteligencia artificial. Las fotos pueden no ser exactas
              y los precios son estimados. Revis\u00e1 cada campo antes de guardar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiFilled(false)}
            className="ml-auto p-1 rounded hover:bg-amber-100 text-amber-400 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-200 flex items-start gap-2">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Main layout: sidebar + content (like settings page) */}
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row gap-6">

          {/* ── Sidebar navigation ── */}
          <nav className="sm:w-52 flex-shrink-0">
            <div className="flex sm:flex-col gap-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left ${
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-indigo-500" : "text-gray-400"}`} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Quick settings under tabs */}
            <div className="mt-6 space-y-3 hidden sm:block">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 px-1">Estado</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                  <option value="active">Activo</option>
                  <option value="draft">Borrador</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 px-1">Categor\u00eda</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                  <option value="">Sin categor\u00eda</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 px-1">Tipo</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as "simple" | "variant")}
                  className={inputClass}
                >
                  <option value="simple">Simple</option>
                  <option value="variant">Con variantes</option>
                </select>
              </div>
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100/60 transition">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-amber-800 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Destacado
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2 hidden sm:flex">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm shadow-sm shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</>
                ) : (
                  <><Save className="w-4 h-4" /> Crear producto</>
                )}
              </button>
              <Link
                href="/app/products"
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium text-center"
              >
                Cancelar
              </Link>
            </div>
          </nav>

          {/* ── Content area ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* General */}
            {tab === "general" && (
              <Section title="Informaci\u00f3n general" desc="Nombre y descripci\u00f3n del producto">
                <div>
                  <label className={labelClass}>Nombre <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Ej: Remera Oversize Negro"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Slug (URL)
                    <span className="ml-2 text-xs text-gray-400 font-normal">— se genera autom\u00e1ticamente</span>
                  </label>
                  <div className="flex">
                    <span className="px-3 py-2.5 text-xs text-gray-400 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg shrink-0 flex items-center">
                      /producto/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => { setSlug(e.target.value); setSlugManuallyEdited(true); }}
                      placeholder={slugify(name) || "remera-oversize-negro"}
                      className={`${inputClass} rounded-l-none`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Descripci\u00f3n corta
                    <span className="ml-2 text-xs text-gray-400 font-normal">— aparece en listados</span>
                  </label>
                  <input
                    type="text"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    className={inputClass}
                    placeholder="Una l\u00ednea que resume el producto"
                  />
                </div>

                <div>
                  <label className={labelClass}>Descripci\u00f3n completa</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className={inputClass}
                    placeholder="Materiales, talles disponibles, instrucciones de uso\u2026"
                  />
                  {description && (
                    <p className="mt-1 text-xs text-gray-400">{description.length} caracteres</p>
                  )}
                </div>
              </Section>
            )}

            {/* Pricing */}
            {tab === "pricing" && (
              <Section title="Precios" desc="Precio de venta, descuento y costo interno">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Precio de venta <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className={`${inputClass} pl-7`}
                        placeholder="0.00"
                        required
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
                        min="0"
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
                      <span className="ml-1 text-xs text-gray-400 font-normal">— solo visible para vos</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        className={`${inputClass} pl-7`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                {discountPct !== null && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-xs text-green-700">
                    Se mostrar\u00e1 un <strong>{discountPct}% de descuento</strong> en la tienda.
                  </div>
                )}
              </Section>
            )}

            {/* Inventory */}
            {tab === "inventory" && (
              <Section title="Inventario" desc="Control de stock y c\u00f3digo interno">
                <div>
                  <label className={labelClass}>
                    SKU
                    <span className="ml-2 text-xs text-gray-400 font-normal">— c\u00f3digo \u00fanico interno</span>
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={inputClass}
                    placeholder="Ej: REM-OVS-NEG-M"
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
                      <p className="text-xs text-gray-400 mt-0.5">Nexora llevar\u00e1 la cuenta del stock autom\u00e1ticamente</p>
                    </div>
                  </label>
                  {trackInventory && productType === "simple" && (
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
                  {trackInventory && productType === "variant" && (
                    <p className="pl-7 text-xs text-gray-400">El stock se define por variante en la pesta\u00f1a Variantes.</p>
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
                      <p className="text-xs text-gray-400 mt-0.5">Los clientes podr\u00e1n comprar aunque no haya unidades</p>
                    </div>
                  </label>
                </div>
              </Section>
            )}

            {/* Images */}
            {tab === "images" && (
              <Section title="Im\u00e1genes del producto" desc="Fotos que ver\u00e1n tus clientes en la tienda">
                {/* AI images warning */}
                {hasAiImages && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                    <span>
                      Las fotos fueron elegidas por IA buscando algo similar a tu producto.
                      Puede que no sean exactas — reemplaz\u00e1 las que no te sirvan.
                    </span>
                  </div>
                )}

                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.file ? URL.createObjectURL(img.file) : img.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {img.isCover && (
                          <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[10px] bg-indigo-600 text-white font-medium leading-none">
                            Portada
                          </span>
                        )}
                        {img.fromAi && (
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] bg-violet-600 text-white font-medium leading-none flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> IA
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
                          {!img.isCover && (
                            <button
                              type="button"
                              onClick={() => setImages((imgs) => imgs.map((x, j) => ({ ...x, isCover: j === i })))}
                              className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-indigo-600 transition"
                              title="Hacer portada"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setImages((imgs) => {
                                const filtered = imgs.filter((_, j) => j !== i);
                                if (img.isCover && filtered.length > 0)
                                  return filtered.map((x, j) => ({ ...x, isCover: j === 0 }));
                                return filtered;
                              })
                            }
                            className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-red-600 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/40 transition flex flex-col items-center gap-1.5"
                >
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Subir im\u00e1genes</span>
                  <span className="text-xs">jpg, png, gif, webp \u00b7 m\u00e1x 5MB c/u</span>
                </button>
                {images.length > 0 && (
                  <p className="text-xs text-gray-400 text-center">
                    Pas\u00e1 el cursor sobre una imagen para establecer la portada o eliminarla.
                  </p>
                )}
              </Section>
            )}

            {/* Variants */}
            {tab === "variants" && (
              <Section title="Variantes" desc="Tallas, colores u otras opciones disponibles">
                {productType !== "variant" ? (
                  <div className="text-center py-8">
                    <Layers className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-1">Las variantes est\u00e1n desactivadas</p>
                    <p className="text-xs text-gray-400 mb-4">
                      Cambi\u00e1 el tipo de producto a &quot;Con variantes&quot; en la barra lateral para activarlas.
                    </p>
                    <button
                      type="button"
                      onClick={() => setProductType("variant")}
                      className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition"
                    >
                      Activar variantes
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {variants.map((v, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-end p-4 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="col-span-5 sm:col-span-4">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                            <input
                              type="text"
                              value={v.name}
                              onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                              placeholder="Ej: Talle M / Rojo"
                              className={inputClass}
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>
                            <input
                              type="text"
                              value={v.sku}
                              onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                              className={inputClass}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Precio</label>
                            <input
                              type="number"
                              step="0.01"
                              value={v.price}
                              onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                              className={inputClass}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="col-span-1 sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                            <input
                              type="number"
                              min="0"
                              value={v.stock}
                              onChange={(e) => setVariants((prev) => prev.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))}
                              className={inputClass}
                            />
                          </div>
                          <div className="col-span-1 flex justify-end pb-0.5">
                            <button
                              type="button"
                              onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}
                              className="p-2.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                              title="Eliminar variante"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setVariants((v) => [...v, { name: "", sku: "", price: "", stock: "0" }])}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600 transition w-full justify-center"
                    >
                      <Plus className="w-4 h-4" /> A\u00f1adir variante
                    </button>
                  </>
                )}
              </Section>
            )}

            {/* SEO */}
            {tab === "seo" && (
              <Section title="SEO" desc="C\u00f3mo aparece este producto en Google (opcional)">
                <div>
                  <label className={labelClass}>
                    T\u00edtulo para Google
                    <span className="ml-2 text-xs text-gray-400 font-normal">— m\u00e1x. 60 caracteres</span>
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className={inputClass}
                    placeholder="Si lo dej\u00e1s vac\u00edo se usa el nombre del producto"
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
                    Descripci\u00f3n para Google
                    <span className="ml-2 text-xs text-gray-400 font-normal">— m\u00e1x. 160 caracteres</span>
                  </label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    rows={3}
                    className={inputClass}
                    placeholder="Descripci\u00f3n bajo el t\u00edtulo en resultados de b\u00fasqueda"
                    maxLength={160}
                  />
                  {seoDescription && (
                    <p className={`mt-1 text-xs ${seoDescription.length > 150 ? "text-amber-500" : "text-gray-400"}`}>
                      {seoDescription.length}/160 caracteres
                    </p>
                  )}
                </div>

                {/* Google preview */}
                {(seoTitle || name) && (
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Vista previa en Google</p>
                    <p className="text-blue-700 text-sm font-medium truncate">{seoTitle || name}</p>
                    <p className="text-green-700 text-xs truncate">tutienda.com/producto/{slug || "..."}</p>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
                      {seoDescription || shortDescription || description?.slice(0, 160) || "Descripci\u00f3n del producto..."}
                    </p>
                  </div>
                )}
              </Section>
            )}

            {/* Mobile-only: quick settings + submit */}
            <div className="sm:hidden space-y-4">
              <div className="bg-white rounded-xl border border-gray-200/60 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Configuraci\u00f3n</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                    <option value="active">Activo</option>
                    <option value="draft">Borrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categor\u00eda</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                    <option value="">Sin categor\u00eda</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as "simple" | "variant")}
                    className={inputClass}
                  >
                    <option value="simple">Simple</option>
                    <option value="variant">Con variantes</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition text-sm shadow-sm shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : <><Save className="w-4 h-4" /> Crear producto</>}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Modal IA ─────────────────────────────────────────────────────── */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!aiLoading) { setAiModalOpen(false); setAiError(""); } }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-display font-bold text-gray-900">Rellenar con IA</h2>
                <p className="text-xs text-gray-400">GPT-4o + Pexels \u00b7 ~10 segundos</p>
              </div>
              {!aiLoading && (
                <button
                  type="button"
                  onClick={() => { setAiModalOpen(false); setAiError(""); }}
                  className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Describ\u00ed el producto en pocas palabras
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={aiLoading}
                rows={3}
                placeholder="Ej: remera oversize negra para streetwear, unisex, algod\u00f3n"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition resize-none disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !aiLoading && aiPrompt.trim()) {
                    e.preventDefault();
                    handleAiFill();
                  }
                }}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Cuanto m\u00e1s espec\u00edfico, mejor resultado. Pod\u00e9s editar todo despu\u00e9s.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-500 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
              <span>La IA puede equivocarse. Revis\u00e1 que las fotos y los datos sean correctos antes de guardar.</span>
            </div>

            {aiLoading && (
              <div className="mb-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-indigo-800">
                      {aiStep === "thinking" && "GPT-4o generando informaci\u00f3n del producto..."}
                      {aiStep === "images" && "Buscando y descargando im\u00e1genes de Pexels..."}
                    </p>
                    <p className="text-xs text-indigo-500 mt-0.5">Esto puede tardar unos segundos</p>
                  </div>
                </div>
              </div>
            )}

            {aiError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
                <X className="w-4 h-4 mt-0.5 shrink-0" />
                {aiError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAiFill}
                disabled={aiLoading || !aiPrompt.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-semibold hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/25"
              >
                {aiLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generar producto</>
                )}
              </button>
              {!aiLoading && (
                <button
                  type="button"
                  onClick={() => { setAiModalOpen(false); setAiError(""); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
