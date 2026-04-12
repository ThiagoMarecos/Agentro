"use client";

import Link from "next/link";
import { getGoogleAuthUrl } from "@/lib/auth";

export function HeroSection() {
  return (
    <section className="relative flex items-center justify-center min-h-[100svh] overflow-hidden">
      {/* Un solo orbe sutil */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/[0.07] rounded-full blur-[180px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <p className="text-[13px] text-text-muted mb-8 tracking-wide uppercase opacity-0 animate-fade-in">
          Plataforma de e-commerce con IA
        </p>

        <h1 className="heading-page text-[clamp(2.5rem,7vw,5.5rem)] leading-[1] tracking-tight mb-8 opacity-0 animate-fade-in-up delay-100">
          Creá tu tienda.
          <br />
          <span className="text-gradient-nexora">La IA vende por vos.</span>
        </h1>

        <p className="text-lg sm:text-xl text-text-muted leading-relaxed max-w-lg mx-auto mb-12 opacity-0 animate-fade-in-up delay-200">
          Armá tu tienda online, cargá productos y un agente de IA
          atiende a tus clientes y cierra ventas automáticamente.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-in-up delay-300">
          <Link
            href={getGoogleAuthUrl()}
            className="group px-8 py-4 rounded-xl bg-white text-background font-semibold text-[15px] hover:bg-white/90 transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.1)]"
          >
            Crear mi tienda gratis
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <a
            href="#como-funciona"
            className="px-8 py-4 rounded-xl text-text-muted text-[15px] hover:text-text-primary transition-colors"
          >
            Ver cómo funciona
          </a>
        </div>

        <p className="text-[13px] text-text-muted/60 mt-10 opacity-0 animate-fade-in delay-500">
          Sin tarjeta de crédito · Lista en 3 minutos · IA incluida
        </p>
      </div>
    </section>
  );
}
