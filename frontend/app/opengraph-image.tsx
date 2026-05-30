import { ImageResponse } from "next/og";

/**
 * Open Graph image dinámica para la home y rutas que no tengan su propia.
 * Next.js genera esto en build time y lo sirve en /opengraph-image.
 * 1200x630 es el tamaño recomendado por OG / Twitter / WhatsApp.
 *
 * IMPORTANTE: @vercel/og usa Satori y requiere `display: flex` o `display: none`
 * en cualquier <div> que tenga más de un hijo. Por eso TODOS los divs acá
 * tienen display flex explícito.
 */

export const runtime = "edge";
export const alt = "Agentro — La IA vende. Vos cerrás.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(139,111,255,0.35) 0%, transparent 55%), linear-gradient(180deg, #05060f 0%, #0a0b1a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Logo mark + nombre */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background:
                "linear-gradient(135deg, #b39bff 0%, #8b6fff 100%)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 32px rgba(139,111,255,0.6)",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            Agentro
          </div>
        </div>

        {/* Tagline (cada parte en flex para que Satori esté contento) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            fontSize: "80px",
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            marginBottom: "32px",
            maxWidth: "1000px",
            gap: "16px",
          }}
        >
          <span style={{ display: "flex" }}>La IA vende.</span>
          <span
            style={{
              display: "flex",
              background: "linear-gradient(135deg, #b39bff, #8b6fff)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Vos cerrás.
          </span>
        </div>

        {/* Sub */}
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            color: "#9ba0c0",
            textAlign: "center",
            maxWidth: "900px",
            lineHeight: 1.4,
            marginBottom: "60px",
          }}
        >
          El agente de IA que atiende WhatsApp 24/7, muestra tu catálogo y te pasa el cliente listo para cobrar.
        </div>

        {/* Bottom kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "12px 24px",
            borderRadius: "100px",
            border: "1px solid rgba(139,111,255,0.4)",
            background: "rgba(139,111,255,0.1)",
            fontSize: "18px",
            color: "#b39bff",
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#8b6fff",
              boxShadow: "0 0 12px #8b6fff",
            }}
          />
          <span style={{ display: "flex" }}>getagentro.com · beta cerrada</span>
        </div>
      </div>
    ),
    size
  );
}
