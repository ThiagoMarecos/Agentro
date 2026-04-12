"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/context/StoreContext";
import { analyzeUrlWithStore, acceptImportLegal, type ScrapedProduct } from "@/lib/api/import";
import { bulkImportProducts } from "@/lib/api/products";
import { formatPrice } from "@/lib/utils/formatPrice";
import {
  ArrowLeft, Globe, AlertTriangle, CheckCircle2,
  Loader2, ExternalLink, Package,
  ImageIcon, RefreshCw, Shield, Check,
  ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";

type Step = "input" | "analyzing" | "preview";

const LEGAL_ITEMS = [
  "Todo el contenido importado (imágenes, textos, precios) pertenece a sus respectivos propietarios y está protegido por derechos de autor.",
  "El uso de esta herramienta se realiza bajo la exclusiva responsabilidad del propietario de la cuenta.",
  "Agentro actúa únicamente como intermediario tecnológico y no se hace responsable por el uso que se le dé a los datos importados.",
  "El usuario se compromete a verificar que el uso del contenido cumple con las leyes de su jurisdicción.",
  "Queda prohibido usar esta función para copiar catálogos de competidores con fines de competencia desleal.",
  "Al aceptar, se genera un registro de auditoría con validez de documento legal (usuario, fecha, hora, IP y URL).",
];

/** Format a scraped price for preview.
 *  If currency is known (after conversion), format with symbol (Gs. 426.300).
 *  Otherwise use neutral numeric format (426.300).
 */
function formatScrapedPrice(price: number, currency?: string | null): string {
  if (currency) {
    return formatPrice(price, currency);
  }
  // Neutral format when currency is unknown
  if (price >= 10000) {
    return price.toLocaleString("es-PY", { maximumFractionDigits: 0 });
  }
  return price.toLocaleString("es-PY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ProductGridCard({
  product,
  selected,
  onClick,
  currency,
}: {
  product: ScrapedProduct;
  selected: boolean;
  onClick: () => void;
  currency?: string | null;
}) {
  const firstImage = product.image_urls?.[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left rounded-xl border-2 overflow-hidden transition-all ${
        selected
          ? "border-indigo-500 bg-indigo-50/40 shadow-sm shadow-indigo-500/10"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Selection indicator */}
      <div
        className={`absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
          selected
            ? "bg-indigo-500 border-indigo-500"
            : "bg-white/80 border-gray-300 group-hover:border-gray-400"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" />}
      </div>

      {/* Image */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
        {firstImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </p>
        <div className="flex items-center justify-between mt-2">
          {product.price != null ? (
            <span className="text-sm font-bold text-indigo-600">
              {formatScrapedPrice(product.price, currency)}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Sin precio</span>
          )}
          {product.sku && (
            <span className="text-xs text-gray-400 font-mono truncate max-w-[80px]">
              {product.sku}
            </span>
          )}
        </div>
        {product.compare_at_price != null && product.compare_at_price > (product.price || 0) && (
          <span className="text-xs text-gray-400 line-through">
            {formatScrapedPrice(product.compare_at_price!, currency)}
          </span>
        )}
        {/* Data completeness indicators */}
        <div className="flex items-center gap-1.5 mt-2">
          {product.image_urls?.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500">
              {product.image_urls.length} img
            </span>
          )}
          {product.description && (
            <span className="px-1.5 py-0.5 rounded bg-green-50 text-[10px] text-green-600">
              desc
            </span>
          )}
          {product.sku && (
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[10px] text-blue-600">
              sku
            </span>
          )}
          {product.stock_quantity != null && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
              product.stock_quantity > 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-500"
            }`}>
              {product.stock_quantity > 0 ? `${product.stock_quantity} stock` : "agotado"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ImportFromUrlPage() {
  const { currentStore } = useStore();
  const router = useRouter();

  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [useAiDescriptions, setUseAiDescriptions] = useState(false);

  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<{
    sourceCurrency?: string | null;
    targetCurrency?: string | null;
    pricesConverted?: boolean;
    aiDescriptions?: number;
  }>({});
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; images: number } | null>(null);

  const [analyzeStep, setAnalyzeStep] = useState(0);
  const ANALYZE_STEPS = [
    "Conectando con el sitio web...",
    "Analizando estructura de la página...",
    "Buscando productos y datos estructurados...",
    "Renderizando contenido dinámico (JavaScript)...",
    "Extrayendo nombres, precios, imágenes y stock...",
    "Visitando páginas de productos para datos completos...",
    "Convirtiendo precios a tu moneda...",
    "Generando descripciones con IA...",
    "Casi listo...",
  ];

  const handleAnalyze = async () => {
    if (!currentStore || !url.trim() || !accepted) return;
    setError("");
    setStep("analyzing");
    setAnalyzeStep(0);

    const stepInterval = setInterval(() => {
      setAnalyzeStep((prev) => Math.min(prev + 1, ANALYZE_STEPS.length - 1));
    }, 4000);

    try {
      // 1. Registrar aceptación legal (genera log de auditoría)
      await acceptImportLegal(url.trim(), currentStore.id);

      // 2. Analizar el sitio
      const result = await analyzeUrlWithStore(url.trim(), currentStore.id, {
        generateAiDescriptions: useAiDescriptions,
      });
      clearInterval(stepInterval);

      if (!result.products || result.products.length === 0) {
        setError(
          "No se encontraron productos en esa URL. Puede que el sitio cargue los productos con una tecnología que no podemos leer. Probá con otra URL o con la página de un producto específico."
        );
        setStep("input");
        return;
      }

      setProducts(result.products);
      setStoreName(result.store_name);
      setAiInfo({
        sourceCurrency: result.source_currency,
        targetCurrency: result.target_currency,
        pricesConverted: result.prices_converted,
        aiDescriptions: result.ai_descriptions_generated,
      });
      // Select all by default
      setSelectedIndices(new Set(result.products.map((_, i) => i)));
      setStep("preview");
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "Error al analizar el sitio");
      setStep("input");
    }
  };

  const toggleSelect = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(products.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleImportSelected = async () => {
    if (selectedIndices.size === 0 || !currentStore) return;

    const selected = Array.from(selectedIndices).map((i) => products[i]);

    if (selected.length === 1) {
      // Single product — go to new product form pre-filled
      const product = selected[0];
      sessionStorage.setItem(
        "agentro_import_product",
        JSON.stringify({
          name: product.name || "",
          description: product.description || "",
          price: product.price ?? "",
          compare_at_price: product.compare_at_price ?? "",
          sku: product.sku || "",
          image_urls: product.image_urls || [],
        })
      );
      router.push("/app/products/new");
    } else {
      // Multiple products — bulk import via API
      setImporting(true);
      setError("");
      try {
        const result = await bulkImportProducts(
          currentStore.id,
          selected.map((p) => ({
            name: p.name || "",
            description: p.description || undefined,
            price: p.price ?? undefined,
            compare_at_price: p.compare_at_price ?? undefined,
            sku: p.sku || undefined,
            image_urls: p.image_urls || [],
            stock_quantity: p.stock_quantity ?? undefined,
          }))
        );
        setImportResult({
          count: result.products_imported,
          images: result.images_downloaded,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al importar productos");
      } finally {
        setImporting(false);
      }
    }
  };

  const resetToInput = () => {
    setStep("input");
    setProducts([]);
    setStoreName(null);
    setSelectedIndices(new Set());
    setError("");
    setExpandedProduct(null);
  };

  const selectedCount = selectedIndices.size;

  return (
    <div>
      {/* Header */}
      <Link
        href="/app/products"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a productos
      </Link>

      <div className="mb-7">
        <h1 className="text-2xl font-display font-bold text-gray-900">
          Importar productos
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Pegá la URL de una tienda o categoría y detectamos los productos automáticamente
        </p>
      </div>

      {/* ── STEP 1: Input + Legal ──────────────────────────────── */}
      {step === "input" && (
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar: Legal */}
          <div className="lg:w-72 flex-shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200/60 p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-display font-semibold text-gray-900 text-sm">Aviso legal</h3>
              </div>
              <ul className="space-y-2.5 mb-4">
                {LEGAL_ITEMS.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100/60 transition">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-medium text-amber-900 leading-relaxed">
                  Acepto los términos y condiciones y entiendo que se guardará un registro legal de esta aceptación
                </span>
              </label>
            </div>

            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
              <p className="text-xs text-indigo-700 font-medium mb-1.5">💡 Tip</p>
              <p className="text-xs text-indigo-600 leading-relaxed">
                Funciona mejor con páginas de categorías o búsquedas de tiendas online
                (Shopify, Tiendanube, WooCommerce, MercadoLibre, etc.)
              </p>
            </div>
          </div>

          {/* Content: URL input */}
          <div className="flex-1 min-w-0 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200/60 p-6">
              <h2 className="font-display font-semibold text-gray-900 text-base">URL del sitio</h2>
              <p className="text-xs text-gray-400 mb-4">
                Pegá la URL de la página que contiene los productos que querés importar.
              </p>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.tienda.com/productos/zapatillas"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && accepted && url.trim()) handleAnalyze();
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Página de categoría", "Búsqueda de productos", "Página de un producto"].map((tag) => (
                  <span key={tag} className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-500">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* ── AI descriptions toggle ── */}
            <div
              className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 cursor-pointer select-none"
              onClick={() => setUseAiDescriptions((v) => !v)}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${useAiDescriptions ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"} transition-colors`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Generar descripciones con IA</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Si un producto no tiene descripcion, la IA creara una basada en su nombre y especificaciones
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useAiDescriptions}
                onClick={(e) => { e.stopPropagation(); setUseAiDescriptions((v) => !v); }}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${useAiDescriptions ? "bg-indigo-600" : "bg-gray-300"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${useAiDescriptions ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p>{error}</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!accepted || !url.trim() || !currentStore}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Buscar productos
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Analyzing ──────────────────────────────────── */}
      {step === "analyzing" && (
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl border border-gray-200/60 p-10 flex flex-col items-center text-center">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-6 h-6 text-indigo-400" />
              </div>
            </div>

            <h2 className="font-display font-bold text-gray-900 text-lg mb-2">
              Buscando productos
            </h2>
            <p className="text-sm text-indigo-600 font-medium mb-1 h-5 transition-all">
              {ANALYZE_STEPS[analyzeStep]}
            </p>
            <p className="text-xs text-gray-400 max-w-xs mb-6">
              Esto puede tardar hasta 30 segundos. No cierres esta página.
            </p>

            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-500 max-w-full">
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{url}</span>
            </div>

            <div className="flex items-center gap-2 mt-6">
              {ANALYZE_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-500 ${
                    i <= analyzeStep
                      ? "w-6 h-2 bg-indigo-500"
                      : "w-2 h-2 bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Import success ───────────────────────────────────── */}
      {importResult && (
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-xl border border-gray-200/60 p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="font-display font-bold text-gray-900 text-xl mb-2">
              ¡Productos importados!
            </h2>
            <p className="text-sm text-gray-600 mb-1">
              Se crearon <span className="font-bold text-indigo-600">{importResult.count} productos</span> en tu tienda.
            </p>
            {importResult.images > 0 && (
              <p className="text-xs text-gray-400 mb-6">
                {importResult.images} imágenes descargadas
              </p>
            )}
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => router.push("/app/products")}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition"
              >
                Ver productos
              </button>
              <button
                onClick={() => {
                  setImportResult(null);
                  resetToInput();
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition"
              >
                Importar más
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Product grid preview ───────────────────────── */}
      {step === "preview" && products.length > 0 && !importResult && (
        <div className="space-y-5">

          {/* Top bar: results info + actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-xl border border-gray-200/60 p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-gray-900">
                  {products.length} producto{products.length !== 1 ? "s" : ""} encontrado{products.length !== 1 ? "s" : ""}
                </h2>
                <p className="text-xs text-gray-400">
                  {storeName && <>{storeName} · </>}
                  {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
                </p>
                {/* AI processing badges */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {aiInfo.pricesConverted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full">
                      💱 Precios convertidos: {aiInfo.sourceCurrency} → {aiInfo.targetCurrency}
                    </span>
                  )}
                  {(aiInfo.aiDescriptions ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 rounded-full">
                      🤖 {aiInfo.aiDescriptions} descripción{aiInfo.aiDescriptions !== 1 ? "es" : ""} generada{aiInfo.aiDescriptions !== 1 ? "s" : ""} con IA
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectedCount === products.length ? deselectAll : selectAll}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                {selectedCount === products.length ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              <button
                type="button"
                onClick={resetToInput}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                Otra URL
              </button>
            </div>
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product, idx) => (
              <div key={idx}>
                <ProductGridCard
                  product={product}
                  selected={selectedIndices.has(idx)}
                  onClick={() => toggleSelect(idx)}
                  currency={aiInfo.targetCurrency}
                />
                {/* Inline detail toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedProduct(expandedProduct === idx ? null : idx)}
                  className="w-full mt-1 py-1 text-[11px] text-gray-400 hover:text-indigo-600 transition flex items-center justify-center gap-1"
                >
                  {expandedProduct === idx ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Ver detalle
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Expanded product detail panel */}
          {expandedProduct !== null && products[expandedProduct] && (
            <div className="bg-white rounded-xl border border-gray-200/60 p-5 animate-in slide-in-from-top-2">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-gray-900 text-base">
                    {products[expandedProduct].name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    {products[expandedProduct].price != null && (
                      <span className="text-sm font-bold text-indigo-600">
                        {formatScrapedPrice(products[expandedProduct].price!, aiInfo.targetCurrency)}
                      </span>
                    )}
                    {products[expandedProduct].compare_at_price != null && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatScrapedPrice(products[expandedProduct].compare_at_price!, aiInfo.targetCurrency)}
                      </span>
                    )}
                    {products[expandedProduct].sku && (
                      <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {products[expandedProduct].sku}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedProduct(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              {products[expandedProduct].description ? (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Descripción</p>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {products[expandedProduct].description}
                  </div>
                </div>
              ) : (
                <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-700">
                    Sin descripción — se puede completar después de importar.
                  </p>
                </div>
              )}

              {/* All images */}
              {products[expandedProduct].image_urls?.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Imágenes ({products[expandedProduct].image_urls.length})
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {products[expandedProduct].image_urls.map((img, i) => (
                      <div key={i} className="w-24 h-24 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <p className="text-xs text-amber-700">
                    Sin imágenes detectadas — se pueden subir después.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Import button (sticky at bottom) */}
          <div className="sticky bottom-4 z-20">
            <div className="bg-white rounded-xl border border-gray-200/60 p-4 shadow-lg shadow-gray-200/50 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 min-w-0">
                {importing ? (
                  <>
                    <p className="text-sm text-indigo-700 font-medium">
                      Importando {selectedCount} producto{selectedCount !== 1 ? "s" : ""}...
                    </p>
                    <p className="text-xs text-indigo-500 mt-0.5">
                      Descargando imágenes y creando productos. Esto puede tardar un momento, no cierres la página.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      {selectedCount === 0 ? (
                        "Seleccioná al menos un producto para importar"
                      ) : selectedCount === 1 ? (
                        <>
                          <span className="font-semibold">1 producto</span> seleccionado — se abrirá el formulario de creación
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{selectedCount} productos</span> seleccionados para importar
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selectedCount === 1
                        ? "Vas a poder editar toda la información antes de guardar."
                        : selectedCount > 1
                          ? "Se van a crear con toda su información. Después podés editarlos."
                          : ""}
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleImportSelected}
                disabled={selectedCount === 0 || importing}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    {selectedCount <= 1 ? "Usar en formulario" : `Importar ${selectedCount} productos`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
