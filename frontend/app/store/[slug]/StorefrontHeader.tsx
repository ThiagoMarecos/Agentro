"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getStore, searchProducts } from "@/lib/api/storefront";
import { ShoppingBag, Menu, X, Heart, Search, Package } from "lucide-react";
import { useCart } from "@/lib/context/CartContext";

interface StoreData {
  name: string;
  logo_url?: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  price: string;
  images?: { url: string; alt?: string }[];
}

function SearchOverlay({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const doSearch = useCallback(
    (term: string) => {
      if (!term.trim()) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      searchProducts(slug, term)
        .then((res) => {
          setResults(res);
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    },
    [slug],
  );

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      doSearch(query);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "var(--color-surface-card, #fff)", border: "1px solid var(--color-border)" }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Search className="w-5 h-5 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Buscar productos..."
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: "var(--color-text)", fontFamily: "var(--font-family)" }}
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </form>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-5 py-8 text-center">
              <div
                className="w-6 h-6 border-2 rounded-full animate-spin mx-auto"
                style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-primary)" }}
              />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/store/${slug}/product/${product.id}`}
                  onClick={onClose}
                  className="flex items-center gap-4 px-5 py-3 transition-colors"
                  style={{ color: "var(--color-text)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--color-surface-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <div
                    className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: "var(--color-surface-alt)" }}
                  >
                    {product.images?.[0]?.url ? (
                      <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: "var(--color-text-subtle)" }}>
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>
                      ${product.price}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="px-5 py-10 text-center">
              <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--color-text-subtle)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                No se encontraron productos
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                Probá con otro término de búsqueda
              </p>
            </div>
          )}

          {!loading && !searched && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Escribí para buscar productos...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StorefrontHeader({ slug }: { slug: string }) {
  const [store, setStore] = useState<StoreData | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount } = useCart();

  useEffect(() => {
    getStore(slug).then((s) => setStore(s)).catch(() => setStore(null));
  }, [slug]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: `/store/${slug}`, label: "Inicio" },
    { href: `/store/${slug}/catalog`, label: "Catálogo" },
    { href: `/store/${slug}/drops`, label: "Drops" },
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "backdrop-blur-xl shadow-sm" : ""} border-b`}
        style={{
          backgroundColor: scrolled ? "color-mix(in srgb, var(--color-background) 90%, transparent)" : "var(--color-background)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href={`/store/${slug}`} className="flex items-center gap-2 flex-shrink-0">
              {store?.logo_url ? (
                <img src={store.logo_url} alt={store.name || ""} className="h-8 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <span
                  className="text-xl font-bold"
                  style={{ color: "var(--color-text)", fontFamily: "var(--font-heading)" }}
                >
                  {store?.name || "Tienda"}
                </span>
              )}
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition-colors"
                  style={{ color: "var(--color-text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg transition"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                aria-label="Buscar"
              >
                <Search className="w-5 h-5" />
              </button>
              <Link
                href={`/store/${slug}/wishlist`}
                className="p-2 rounded-lg transition hidden sm:flex"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                <Heart className="w-5 h-5" />
              </Link>
              <Link
                href={`/store/${slug}/cart`}
                className="relative p-2 rounded-lg transition"
                style={{ color: "var(--color-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-fg)" }}
                  >
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg transition"
                style={{ color: "var(--color-text-muted)" }}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div
              className="md:hidden pb-4 border-t mt-1 pt-3 space-y-1"
              style={{ borderColor: "var(--color-border)" }}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 transition text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={`/store/${slug}/wishlist`}
                onClick={() => setMobileOpen(false)}
                className="block py-2 transition text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                Lista de deseos
              </Link>
            </div>
          )}
        </div>
      </header>

      {searchOpen && <SearchOverlay slug={slug} onClose={() => setSearchOpen(false)} />}
    </>
  );
}
