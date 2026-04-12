"use client";

import { useState } from "react";
import {
  Globe,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Circle,
  Package,
  Palette,
  Layout,
  Image as ImageIcon,
  Type,
  ShoppingBag,
  Mail,
  Megaphone,
  Check,
  ExternalLink,
} from "lucide-react";
import { useStore } from "@/lib/context/StoreContext";
import {
  analyzeUrlWithStore,
  executeImport,
  type AnalyzeResponse,
  type ScrapedProduct,
  type ScrapedSection,
  type ImportResult,
} from "@/lib/api/import";

const SECTION_ICONS: Record<string, React.ReactNode> = {
  hero: <Megaphone className="w-4 h-4" />,
  image_slider: <ImageIcon className="w-4 h-4" />,
  featured_products: <ShoppingBag className="w-4 h-4" />,
  newsletter: <Mail className="w-4 h-4" />,
  banner: <Type className="w-4 h-4" />,
};

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero / Banner principal",
  image_slider: "Slider de imágenes",
  featured_products: "Productos destacados",
  newsletter: "Newsletter",
  banner: "Banner de texto",
};

const LOADING_MESSAGES = [
  "Conectando con el sitio...",
  "Buscando productos...",
  "Analizando diseño...",
  "Detectando secciones...",
  "Casi listo...",
];

type PageState = "input" | "analyzing" | "preview" | "importing" | "done";

export default function ImportPage() {
  const { currentStore } = useStore();
  const [url, setUrl] = useState("");
  const [state, setState] = useState<PageState>("input");
  const [error, setError] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);

  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null);
  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [sections, setSections] = useState<ScrapedSection[]>([]);
  const [importProducts, setImportProducts] = useState(true);
  const [importDesign, setImportDesign] = useState(true);
  const [importSections, setImportSections] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const storeId = currentStore?.id;

  const handleAnalyze = async () => {
    if (!url.trim() || !storeId) return;
    setError("");
    setState("analyzing");
    setMsgIndex(0);

    const interval = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 3500);

    try {
      const data = await analyzeUrlWithStore(url.trim(), storeId);
      clearInterval(interval);
      setAnalyzeData(data);
      setProducts(data.products.map((p) => ({ ...p, selected: true })));
      setSections(data.sections.map((s) => ({ ...s, selected: true })));
      setState("preview");
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Error al analizar el sitio");
      setState("input");
    }
  };

  const handleImport = async () => {
    if (!storeId || !analyzeData) return;
    setState("importing");
    setError("");

    try {
      const selected = products.filter((p) => p.selected);
      const selectedSections = sections.filter((s) => s.selected);

      const res = await executeImport(storeId, {
        url,
        products: importProducts ? selected : [],
        design: importDesign ? analyzeData.design : null,
        sections: importSections ? selectedSections : [],
        import_products: importProducts,
        import_design: importDesign,
        import_sections: importSections,
      });
      setResult(res);
      setState("done");
    } catch (err: any) {
      setError(err.message || "Error al importar");
      setState("preview");
    }
  };

  const handleReset = () => {
    setState("input");
    setUrl("");
    setAnalyzeData(null);
    setProducts([]);
    setSections([]);
    setResult(null);
    setError("");
  };

  const toggleProduct = (idx: number) => {
    setProducts((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)));
  };

  const toggleAllProducts = () => {
    const allSelected = products.every((p) => p.selected);
    setProducts((prev) => prev.map((p) => ({ ...p, selected: !allSelected })));
  };

  const toggleSection = (idx: number) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)));
  };

  const hasDesign = analyzeData
    ? !!(analyzeData.design.primary_color || analyzeData.design.logo_url || analyzeData.design.font_heading)
    : false;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Importar desde web</h1>
        <p className="text-text-muted">
          Importá productos, diseño y secciones desde un sitio web existente.
        </p>
      </div>

      {(state === "input" || state === "analyzing") && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-6">
              <Globe className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-center mb-1">URL del sitio</h2>
            <p className="text-sm text-text-muted text-center mb-6">
              Ingresá la dirección web de la tienda que querés importar
            </p>

            <div className="relative mb-4">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && state === "input" && handleAnalyze()}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/5 border border-white/10 focus:border-primary focus:outline-none text-base"
                placeholder="https://mitienda.com"
                disabled={state === "analyzing"}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {state === "analyzing" && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 mb-4">
                <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">{LOADING_MESSAGES[msgIndex]}</p>
                  <p className="text-xs text-text-muted mt-0.5">Esto puede tomar unos segundos...</p>
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={state === "analyzing" || !url.trim()}
              className="w-full bg-gradient-agentro px-6 py-3.5 rounded-xl font-semibold text-white hover:opacity-90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
            >
              {state === "analyzing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  Analizar sitio
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {state === "preview" && analyzeData && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold">Resultados del análisis</h2>
              <button onClick={handleReset} className="text-xs text-text-muted hover:text-white transition">
                Analizar otra URL
              </button>
            </div>
            {analyzeData.store_name && (
              <p className="text-primary font-medium text-sm mb-1">{analyzeData.store_name}</p>
            )}
            <p className="text-xs text-text-muted">
              {analyzeData.product_count} productos · {analyzeData.image_count} imágenes · {analyzeData.sections.length} secciones
            </p>
          </div>

          {products.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={importProducts} onChange={() => setImportProducts(!importProducts)} className="accent-primary w-4 h-4" />
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Productos ({products.length})</span>
                </label>
                {importProducts && (
                  <button onClick={toggleAllProducts} className="text-xs text-primary hover:underline">
                    {products.every((p) => p.selected) ? "Deseleccionar todos" : "Seleccionar todos"}
                  </button>
                )}
              </div>
              {importProducts && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((product, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleProduct(idx)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        product.selected ? "border-primary/50 bg-primary/5" : "border-white/10 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex-shrink-0">
                          {product.selected ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4 text-text-muted" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          {product.image_urls[0] && (
                            <div className="w-full aspect-square rounded-lg bg-white/5 overflow-hidden mb-2">
                              <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-contain" loading="lazy" />
                            </div>
                          )}
                          <p className="text-xs font-medium truncate">{product.name}</p>
                          {product.price != null && <p className="text-xs text-primary font-semibold">${product.price}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasDesign && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={importDesign} onChange={() => setImportDesign(!importDesign)} className="accent-primary w-4 h-4" />
                <Palette className="w-4 h-4 text-violet-400" />
                <span className="font-semibold">Diseño detectado</span>
              </label>
              {importDesign && (
                <div className="space-y-3">
                  {(analyzeData.design.primary_color || analyzeData.design.secondary_color || analyzeData.design.background_color) && (
                    <div>
                      <p className="text-xs text-text-muted mb-2">Paleta de colores</p>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { label: "Primario", color: analyzeData.design.primary_color },
                          { label: "Secundario", color: analyzeData.design.secondary_color },
                          { label: "Fondo", color: analyzeData.design.background_color },
                          { label: "Texto", color: analyzeData.design.text_color },
                        ]
                          .filter((c) => c.color)
                          .map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg border border-white/20" style={{ backgroundColor: c.color! }} />
                              <div>
                                <p className="text-[10px] text-text-muted">{c.label}</p>
                                <p className="text-xs font-mono">{c.color}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  {analyzeData.design.font_heading && (
                    <p className="text-sm"><span className="text-text-muted">Fuente:</span> {analyzeData.design.font_heading}</p>
                  )}
                  {analyzeData.design.logo_url && (
                    <div>
                      <p className="text-xs text-text-muted mb-1">Logo</p>
                      <img src={analyzeData.design.logo_url} alt="Logo" className="h-10 object-contain rounded bg-white/10 p-1" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {sections.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={importSections} onChange={() => setImportSections(!importSections)} className="accent-primary w-4 h-4" />
                <Layout className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Secciones ({sections.length})</span>
              </label>
              {importSections && (
                <div className="space-y-2">
                  {sections.map((section, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleSection(idx)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        section.selected ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 opacity-50"
                      }`}
                    >
                      {section.selected ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-text-muted" />}
                      {SECTION_ICONS[section.type] || <Layout className="w-4 h-4" />}
                      <div>
                        <p className="text-sm font-medium">{SECTION_LABELS[section.type] || section.type}</p>
                        {section.images.length > 0 && <p className="text-xs text-text-muted">{section.images.length} imágenes</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleImport}
            className="w-full bg-gradient-agentro px-6 py-4 rounded-xl font-semibold text-white hover:opacity-90 transition inline-flex items-center justify-center gap-2"
          >
            Importar seleccionados
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {state === "importing" && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">Importando...</h2>
          <p className="text-sm text-text-muted">Descargando imágenes y creando productos. Esto puede tomar unos segundos.</p>
        </div>
      )}

      {state === "done" && result && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-1">¡Importación completa!</h2>
            <p className="text-sm text-text-muted">Los datos fueron importados a tu tienda.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <p className="text-3xl font-bold text-primary">{result.products_imported}</p>
              <p className="text-xs text-text-muted mt-1">Productos</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <p className="text-3xl font-bold text-violet-400">{result.images_downloaded}</p>
              <p className="text-xs text-text-muted mt-1">Imágenes</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 text-center">
              <p className="text-3xl font-bold text-emerald-400">{result.sections_created}</p>
              <p className="text-xs text-text-muted mt-1">Secciones</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-400 mb-1">Advertencias</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-text-muted">{e}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/app/products"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium hover:opacity-90 transition"
            >
              <Package className="w-4 h-4" />
              Ver productos
            </a>
            <a
              href="/app/appearance"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 font-medium hover:bg-white/5 transition"
            >
              <Palette className="w-4 h-4" />
              Ver apariencia
            </a>
            <button
              onClick={handleReset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 font-medium hover:bg-white/5 transition"
            >
              <Globe className="w-4 h-4" />
              Importar otra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
