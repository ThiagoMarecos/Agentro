import { getStoredToken } from "@/lib/auth";

const API_URL = "/api/v1";

// Import endpoints use direct backend connection to avoid Next.js proxy timeout (~30s).
// Scraping can take 30-120s depending on the site complexity.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const IMPORT_API_URL = `${BACKEND_URL}/api/v1`;

export interface ScrapedProduct {
  name: string;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  image_urls: string[];
  sku: string | null;
  stock_quantity: number | null;
  selected: boolean;
}

export interface ScrapedDesign {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_color: string | null;
  text_color: string | null;
  font_heading: string | null;
  font_body: string | null;
}

export interface ScrapedSection {
  type: string;
  images: string[];
  texts: string[];
  selected: boolean;
}

export interface AnalyzeResponse {
  store_name: string | null;
  products: ScrapedProduct[];
  design: ScrapedDesign;
  sections: ScrapedSection[];
  product_count: number;
  image_count: number;
  // AI post-processing info
  source_currency?: string | null;
  target_currency?: string | null;
  prices_converted?: boolean;
  ai_descriptions_generated?: number;
}

export interface ImportRequest {
  url: string;
  products: ScrapedProduct[];
  design: ScrapedDesign | null;
  sections: ScrapedSection[];
  import_products: boolean;
  import_design: boolean;
  import_sections: boolean;
}

export interface ImportResult {
  products_imported: number;
  images_downloaded: number;
  design_applied: boolean;
  sections_created: number;
  errors: string[];
}

function authHeaders(storeId?: string) {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (storeId) headers["X-Store-ID"] = storeId;
  return headers;
}

export async function analyzeUrl(url: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${IMPORT_API_URL}/import/preview`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Error al analizar el sitio");
  }
  return res.json();
}

export async function acceptImportLegal(url: string, storeId: string): Promise<{ accepted: boolean; logged_at: string }> {
  const res = await fetch(`${IMPORT_API_URL}/import/accept-legal`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Error al registrar aceptación legal");
  }
  return res.json();
}

export async function analyzeUrlWithStore(
  url: string,
  storeId: string,
  options?: { generateAiDescriptions?: boolean },
): Promise<AnalyzeResponse> {
  const res = await fetch(`${IMPORT_API_URL}/import/analyze`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify({
      url,
      generate_ai_descriptions: options?.generateAiDescriptions ?? false,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Error al analizar el sitio");
  }
  return res.json();
}

export async function executeImport(storeId: string, data: ImportRequest): Promise<ImportResult> {
  const res = await fetch(`${IMPORT_API_URL}/import/execute`, {
    method: "POST",
    headers: authHeaders(storeId),
    body: JSON.stringify({ url: "", ...data }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Error al ejecutar la importación");
  }
  return res.json();
}
