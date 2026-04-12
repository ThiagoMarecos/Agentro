export interface TemplateStore {
  name: string;
  description?: string;
  logo_url?: string | null;
}

export interface TemplateProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price?: string | null;
  images?: { url: string; alt?: string }[];
}

export interface TemplateDrop {
  id: string;
  name: string;
  description?: string;
  drop_date?: string;
  image_url?: string;
}

export interface Section {
  id?: string;
  type: string;
  enabled: boolean;
  order: number;
  config: Record<string, any>;
}

export interface TemplateProps {
  store: TemplateStore;
  products: TemplateProduct[];
  drops: TemplateDrop[];
  slug: string;
  sections?: Section[];
}
