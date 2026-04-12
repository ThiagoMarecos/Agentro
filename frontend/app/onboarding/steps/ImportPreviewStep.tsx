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
      <h1 className="heading-page text-2xl mb-1">Esto es lo que encontramos</h1>
      {data.store_name && (
        <p className="text-primary font-medium text-sm mb-1">{data.store_name}</p>
      )}
      <p className="text-text-muted mb-6 text-sm">
        {data.product_count} productos · {data.image_count} imágenes · {data.sections.length} secciones
      </p>

      <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
        {data.products.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importProducts}
                  onChange={() => setImportProducts(!importProducts)}
                  className="accent-primary w-4 h-4"
                />
                <Package className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Productos ({data.products.length})</span>
              </label>
              {importProducts && (
                <button onClick={toggleAllProducts} className="text-xs text-primary hover:underline">
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
                        ? "border-primary/50 bg-primary/5"
                        : "border-white/10 opacity-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {product.selected ? (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        ) : (
                          <Circle className="w-4 h-4 text-text-muted" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {product.image_urls[0] && (
                          <div className="w-full aspect-square rounded-lg bg-white/5 overflow-hidden mb-2">
                            <img
                              src={product.image_urls[0]}
                              alt={product.name}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <p className="text-xs font-medium truncate">{product.name}</p>
                        {product.price != null && (
                          <p className="text-xs text-primary font-semibold">${product.price}</p>
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
                className="accent-primary w-4 h-4"
              />
              <Palette className="w-4 h-4 text-violet-400" />
              <span className="font-semibold text-sm">Diseño detectado</span>
            </label>
            {importDesign && (
              <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
                {(data.design.primary_color || data.design.secondary_color || data.design.background_color) && (
                  <div>
                    <p className="text-xs text-text-muted mb-2">Paleta de colores</p>
                    <div className="flex gap-2">
                      {[data.design.primary_color, data.design.secondary_color, data.design.background_color, data.design.text_color]
                        .filter(Boolean)
                        .map((color, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <div
                              className="w-7 h-7 rounded-lg border border-white/20"
                              style={{ backgroundColor: color! }}
                            />
                            <span className="text-xs text-text-muted font-mono">{color}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {data.design.font_heading && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Tipografía</p>
                    <p className="text-sm font-medium">{data.design.font_heading}</p>
                  </div>
                )}
                {data.design.logo_url && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Logo</p>
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
                className="accent-primary w-4 h-4"
              />
              <Layout className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm">Secciones ({data.sections.length})</span>
            </label>
            {importSections && (
              <div className="space-y-2">
                {sections.map((section, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleSection(idx)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      section.selected
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-white/10 opacity-50"
                    }`}
                  >
                    {section.selected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-text-muted flex-shrink-0" />
                    )}
                    {SECTION_ICONS[section.type] || <Layout className="w-4 h-4" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{SECTION_LABELS[section.type] || section.type}</p>
                      {section.images.length > 0 && (
                        <p className="text-xs text-text-muted">{section.images.length} imágenes</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/5 transition"
        >
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="bg-gradient-agentro px-6 py-3 rounded-xl font-semibold text-white hover:opacity-90 transition"
        >
          {totalSelections > 0 ? `Continuar con ${totalSelections} elementos` : "Continuar sin importar"}
        </button>
      </div>
    </div>
  );
}
