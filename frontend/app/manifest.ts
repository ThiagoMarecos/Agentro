import type { MetadataRoute } from "next";

/**
 * PWA manifest — habilita "Add to Home Screen" en mobile y mejora SEO.
 * Cuando el dueño de tienda lo instala desde su celular, queda como una
 * app más en su pantalla principal.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Agentro — La IA vende. Vos cerrás.",
    short_name: "Agentro",
    description:
      "Agente de IA que vende por WhatsApp 24/7. Tienda online + POS + equipo, todo en uno.",
    start_url: "/",
    display: "standalone",
    background_color: "#05060f",
    theme_color: "#05060f",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "shopping"],
    lang: "es",
    icons: [
      {
        src: "/favicon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
