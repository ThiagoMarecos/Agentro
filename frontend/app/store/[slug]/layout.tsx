"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatWidget } from "@/components/storefront/ChatWidget";
import { ThemeProvider, ThemeConfig } from "@/components/storefront/ThemeProvider";
import { CartProvider } from "@/lib/context/CartContext";
import { StorefrontHeader } from "./StorefrontHeader";
import { getStore } from "@/lib/api/storefront";

interface StoreInfo {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  theme?: {
    template_name: string;
    custom_config: ThemeConfig;
  };
}

export default function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const slug = params.slug;
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    getStore(slug)
      .then(setStore)
      .catch((e) => {
        if (e.message === "STORE_SUSPENDED") {
          setSuspended(true);
        }
        setStore(null);
      });
  }, [slug]);

  useEffect(() => {
    if (store?.favicon_url) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = store.favicon_url;
    }
    if (store?.name) { document.title = store.name; }
  }, [store]);

  if (suspended) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4" style={{ colorScheme: "light" }}>
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tienda no disponible</h1>
          <p className="text-gray-500 mb-6">
            Esta tienda ha sido suspendida temporalmente por el administrador de la plataforma.
            Si sos el dueño, contactá al soporte de Agentro para más información.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const content = (
    <>
      <StorefrontHeader slug={slug} />
      <main className="min-h-[60vh]">{children}</main>

      <footer style={{ backgroundColor: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8">
            <div>
              {store?.logo_url ? (
                <img src={store.logo_url} alt={store.name || ""} className="h-8 object-contain mb-3" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-lg font-display font-bold mb-3 block" style={{ color: 'var(--color-text)' }}>
                  {store?.name || "Tienda"}
                </span>
              )}
              <p className="text-sm max-w-xs" style={{ color: 'var(--color-text)', opacity: 0.4 }}>
                Tu tienda online con inteligencia artificial.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Link href={`/store/${slug}/catalog`} className="transition hover:opacity-100" style={{ color: 'var(--color-text)', opacity: 0.5 }}>Catálogo</Link>
              <Link href={`/store/${slug}/drops`} className="transition hover:opacity-100" style={{ color: 'var(--color-text)', opacity: 0.5 }}>Drops</Link>
              <Link href={`/store/${slug}/cart`} className="transition hover:opacity-100" style={{ color: 'var(--color-text)', opacity: 0.5 }}>Carrito</Link>
              <Link href={`/store/${slug}/wishlist`} className="transition hover:opacity-100" style={{ color: 'var(--color-text)', opacity: 0.5 }}>Lista de deseos</Link>
            </nav>
          </div>
          <div className="mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text)', opacity: 0.4 }}>
            <span>{store?.name || "Tienda"} - Todos los derechos reservados</span>
            <span style={{ opacity: 1 }}>Powered by <Link href="/" className="font-medium transition" style={{ color: 'var(--color-primary)' }}>Agentro</Link></span>
          </div>
        </div>
      </footer>

      <ChatWidget storeId={store?.id} />
    </>
  );

  return (
    <CartProvider slug={slug}>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        {store?.theme?.custom_config ? (
          <ThemeProvider config={store.theme.custom_config}>{content}</ThemeProvider>
        ) : (
          content
        )}
      </div>
    </CartProvider>
  );
}
