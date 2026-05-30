import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import { StoreProvider } from "@/lib/context/StoreContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const SITE_URL = "https://getagentro.com";

export const viewport: Viewport = {
  themeColor: "#05060f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Agentro — Agente de IA que vende por WhatsApp 24/7",
    template: "%s · Agentro",
  },
  description:
    "Agentro es el agente de IA que vende por vos: atiende WhatsApp 24/7, muestra tu catálogo, responde precios y stock, y te pasa el cliente listo para cobrar. Tienda online + POS + equipo en un solo lugar.",
  applicationName: "Agentro",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "agente de IA",
    "agente IA ventas",
    "vendedor IA",
    "IA para ventas",
    "WhatsApp con IA",
    "automatización de ventas",
    "chatbot ventas",
    "ecommerce con IA",
    "tienda online con IA",
    "atención al cliente con IA",
    "WhatsApp Business automatizado",
    "vender por WhatsApp",
    "automatizar atención al cliente",
    "SaaS ecommerce Latinoamérica",
    "Agentro",
    "getagentro",
  ],
  authors: [{ name: "Agentro" }],
  creator: "Agentro",
  publisher: "Agentro",
  category: "Business Software",
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "Agentro",
    title: "Agentro — Agente de IA que vende por WhatsApp 24/7",
    description:
      "El agente de IA atiende a tus clientes por WhatsApp, muestra tu catálogo y te pasa el cliente listo para cobrar. Tienda online + POS + equipo, todo conectado.",
    // Next.js auto-detecta /app/opengraph-image.tsx — no hace falta declarar images acá
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentro — Agente de IA que vende por WhatsApp 24/7",
    description:
      "El agente de IA atiende a tus clientes por WhatsApp, muestra tu catálogo y te pasa el cliente listo para cobrar.",
    creator: "@agentro",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Cuando tengas Search Console: pegá el código acá
    // google: "tu-codigo-de-verificacion",
  },
};

/**
 * JSON-LD structured data — ayuda a Google a entender qué somos.
 * Schema.org Organization + WebSite + SoftwareApplication.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Agentro",
      url: SITE_URL,
      logo: `${SITE_URL}/agentro-white.png`,
      description:
        "Agentro es el agente de IA que vende por vos: atiende WhatsApp 24/7, muestra tu catálogo, responde precios y stock, y te pasa el cliente listo para cobrar.",
      sameAs: [
        // Agregá tus redes cuando estén:
        // "https://twitter.com/agentro",
        // "https://www.linkedin.com/company/agentro",
        // "https://www.instagram.com/agentro",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Agentro",
      description: "Agente de IA que vende por WhatsApp 24/7",
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "es",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Agentro",
      operatingSystem: "Web",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "AI Sales Agent",
      description:
        "SaaS multi-tenant que combina tienda online, POS, gestión de equipo y un agente de IA que atiende ventas por WhatsApp 24/7.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/LimitedAvailability",
        description: "Beta cerrada por invitación, sin costo durante la fase de evaluación.",
      },
      aggregateRating: undefined, // cuando tengas reseñas reales, las completás
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        {/* JSON-LD structured data para Google */}
        <Script
          id="ld-json-org"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <AuthProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
