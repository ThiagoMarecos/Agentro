"use client";

import { useState } from "react";
import {
  Package,
  Palette,
  Layout,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Type,
  ShoppingBag,
  Mail,
  Megaphone,
} from "lucide-react";
import type { AnalyzeResponse, ScrapedProduct, ScrapedSection } from "@/lib/api/import";

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

interface ImportPreviewStepProps {
  data: AnalyzeResponse;
  onNext: (importData: ImportSelections) => void;
  onBack: () => void;
}

export interface ImportSelections {
  products: ScrapedProduct[];
  design: AnalyzeResponse["design"] | null;
  sections: ScrapedSection[];
  importProducts: boolean;
  importDesign: boolean;
  importSections: boolean;
  url: string;
  storeName: string | null;
}

export function ImportPreviewStep({ data, onNext, onBack }: ImportPreviewStepProps) {
  const [products, setProducts] = useState<ScrapedProduct[]>(
    data.products.map((p) => ({ ...p, selected: true }))
  );
  const [sections, setSections] = useState<ScrapedSection[]>(
    data.sections.map((s) => ({ ...s, selected: true }))
  );
  const [importDesign, setImportDesign] = useState(true);
  const [importProducts, setImportProducts] = useState(true);
  const [importSections, setImportSections] = useState(true);

  const selectedProducts = products.filter((p) => p.selected);
  const selectedSections = sections.filter((s) => s.selected);
  const hasDesign = !!(data.design.primary_color || data.design.logo_url || data.design.font_heading);

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

  const handleNext = () => {
    onNext({
      products: importProducts ? selectedProducts : [],
      design: importDesign ? data.design : null,
      sections: importSections ? selectedSections : [],
      importProducts,
      importDesign: importDesign && hasDesign,
      importSections: importSections && selectedSections.length > 0,
      url: "",
      storeName: data.store_name,
    });
  };

  const totalSelections =
    (importProducts ? selectedProducts.length : 0) +
    (importDesign && hasDesign ? 1 : 0) +
    (importSections ? selectedSections.length : 0);

  return (
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Vista previa
      </div>

      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-1">
        Esto es lo que encontramos
      </h1>
      {data.store_name && (
        <p className="text-violet-300 font-medium text-sm mb-1">{data.store_name}</p>
      )}
      <p className="text-slate-300/75 mb-6 text-sm">
        {data.product_count} productos · {data.image_count} imágenes · {data.sections.length} secciones
      </p>

      <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
        {data.products.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importProducts}
                  onChange={() => setImportProducts(!importProducts)}
                  className="accent-violet-500 w-4 h-4"
                />
                <Package className="w-4 h-4 text-violet-300" />
                <span className="font-semibold text-sm text-white">Productos ({data.products.length})</span>
              </label>
              {importProducts && (
                <button onClick={toggleAllProducts} className="text-xs text-violet-300 hover:text-violet-200 hover:underline">
                  {products.every((p) => p.selected) ? "Deseleccionar todos" : "Seleccionar todos"}
                </button>
              )}
            </div>
            {importProducts && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {products.map((product, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleProduct(idx)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      product.selected
                        ? "border-violet-400/50 bg-violet-500/[0.08]"
                        : "border-white/10 bg-white/[0.02] opacity-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {product.selected ? (
                          <CheckCircle2 className="w-4 h-4 text-violet-300" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {product.image_urls[0] && (
                          <div className="w-full aspect-square rounded-lg bg-white/5 overflow-hidden mb-2 border border-white/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.image_urls[0]}
                              alt={product.name}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <p className="text-xs font-medium truncate text-white">{product.name}</p>
                        {product.price != null && (
                          <p className="text-xs text-violet-300 font-semibold">${product.price}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {hasDesign && (
          <section>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={importDesign}
                onChange={() => setImportDesign(!importDesign)}
                className="accent-violet-500 w-4 h-4"
              />
              <Palette className="w-4 h-4 text-violet-300" />
              <span className="font-semibold text-sm text-white">Diseño detectado</span>
            </label>
            {importDesign && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.04] space-y-3">
                {(data.design.primary_color || data.design.secondary_color || data.design.background_color) && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2">Paleta de colores</p>
                    <div className="flex gap-2 flex-wrap">
                      {[data.design.primary_color, data.design.secondary_color, data.design.background_color, data.design.text_color]
                        .filter(Boolean)
                        .map((color, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div
                              className="w-7 h-7 rounded-lg border border-white/20"
                              style={{ backgroundColor: color! }}
                            />
                            <span className="text-xs text-slate-300/75 font-mono">{color}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {data.design.font_heading && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Tipografía</p>
                    <p className="text-sm font-medium text-white">{data.design.font_heading}</p>
                  </div>
                )}
                {data.design.logo_url && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">Logo</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.design.logo_url}
                      alt="Logo"
                      className="h-10 object-contain rounded bg-white/10 p-1"
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {data.sections.length > 0 && (
          <section>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={importSections}
                onChange={() => setImportSections(!importSections)}
                className="accent-violet-500 w-4 h-4"
              />
              <Layout className="w-4 h-4 text-emerald-300" />
              <span className="font-semibold text-sm text-white">Secciones ({data.sections.length})</span>
            </label>
            {importSections && (
              <div className="space-y-2">
                {sections.map((section, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleSection(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      section.selected
                        ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                        : "border-white/10 bg-white/[0.02] opacity-50"
                    }`}
                  >
                    {section.selected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                    <span className="text-slate-300">{SECTION_ICONS[section.type] || <Layout className="w-4 h-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{SECTION_LABELS[section.type] || section.type}</p>
                      {section.images.length > 0 && (
                        <p className="text-xs text-slate-300/70">{section.images.length} imágenes</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="mt-6 flex gap-3 justify-between">
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5 hover:border-white/25 transition text-sm font-medium"
        >
          ← Atrás
        </button>
        <button
          onClick={handleNext}
          className="px-7 py-3 rounded-xl bg-white text-[#05060f] font-semibold text-sm shadow-[0_0_28px_-4px_rgba(139,111,255,0.5)] hover:bg-[#b39bff] hover:text-white transition-all"
        >
          {totalSelections > 0 ? `Continuar con ${totalSelections} elementos` : "Continuar sin importar"}
        </button>
      </div>
    </div>
  );
}
