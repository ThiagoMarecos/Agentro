import type { MetadataRoute } from "next";

/**
 * robots.txt dinámico.
 * Permitimos indexación de páginas públicas y bloqueamos rutas privadas
 * (panel admin, super admin, login, signup, onboarding, etc.) que no deben
 * aparecer en resultados de Google.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/faq", "/features", "/request-invite", "/privacy", "/terms", "/store/"],
        disallow: [
          "/app/",      // panel privado del owner
          "/admin/",    // super admin
          "/login",
          "/signup",
          "/onboarding",
          "/auth/",
          "/team-invite/",
          "/chat/",
          "/api/",
        ],
      },
    ],
    sitemap: "https://getagentro.com/sitemap.xml",
    host: "https://getagentro.com",
  };
}
