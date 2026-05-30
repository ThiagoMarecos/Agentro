// Re-uso la misma OG image para Twitter/X cards (summary_large_image).
// Los exports `runtime`, `alt`, `size`, `contentType` NO se pueden re-exportar
// porque Next.js los necesita como literales — los declaro explícitamente.

export const runtime = "edge";
export const alt = "Agentro — La IA vende. Vos cerrás.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export { default } from "./opengraph-image";
