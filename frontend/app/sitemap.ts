import type { MetadataRoute } from "next";

/**
 * Sitemap dinámico de páginas públicas indexables.
 *
 * Si en el futuro queremos listar también los storefronts públicos
 * (`/store/[slug]`), se puede hacer una llamada al backend acá para
 * traer todas las tiendas activas y agregarlas al array.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://getagentro.com";
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/features`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/request-invite`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
