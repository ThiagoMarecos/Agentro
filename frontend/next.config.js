/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * Headers HTTP de seguridad globales.
 * Estos suben Mozilla Observatory de F → A+.
 * Si en algún momento agregás un servicio externo (Google Analytics, Stripe, etc.),
 * tenés que sumarlo a la CSP correspondiente.
 */
const securityHeaders = [
  // HSTS — fuerza HTTPS por 2 años + incluye subdominios. Listo para preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Anti-clickjacking — nadie puede embeber tu sitio en un iframe.
  // Mantenemos también X-Frame-Options por compatibilidad con browsers viejos.
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Anti-MIME-sniffing — el browser respeta el Content-Type del server.
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Referrer policy — no mandar URL completa a sitios cross-origin.
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Permissions Policy — desactiva APIs sensibles del browser que no usamos.
  // (Si en el futuro necesitás cámara/micrófono, lo ajustás acá).
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "interest-cohort=()",
      "payment=()",
      "usb=()",
      "fullscreen=(self)",
    ].join(", "),
  },
  // Content Security Policy — lo más fuerte para prevenir XSS.
  // 'self' = nuestro propio dominio.
  // unsafe-inline + unsafe-eval en scripts: Next.js los necesita para hydration.
  // fonts.googleapis.com + fonts.gstatic.com: para las fuentes Inter/Space Grotesk/JetBrains.
  // data: en imgs: para imágenes inline base64.
  // blob: en imgs: para uploads previa al envío.
  // https: en imgs: para previews de productos importados de otros sitios.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://getagentro.com https://*.getagentro.com https://oauth2.googleapis.com https://accounts.google.com https://www.googleapis.com",
      "frame-src 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${BACKEND}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${BACKEND}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
