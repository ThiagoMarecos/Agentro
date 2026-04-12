"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getGoogleAuthUrl } from "@/lib/auth";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-white/[0.06]"
          : ""
      }`}
    >
      <nav className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="brand-nexora text-lg">
          Nexora
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <Link
            href="/login"
            className="text-[13px] text-text-muted hover:text-text-primary transition-colors px-4 py-2 rounded-lg"
          >
            Iniciar sesión
          </Link>
          <a
            href={getGoogleAuthUrl()}
            className="text-[13px] font-medium px-5 py-2 rounded-lg bg-white text-background hover:bg-white/90 transition-all"
          >
            Crear tienda
          </a>
        </div>
      </nav>
    </header>
  );
}
