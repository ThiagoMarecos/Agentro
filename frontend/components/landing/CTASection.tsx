"use client";

import { getGoogleAuthUrl } from "@/lib/auth";
import { AnimateOnScroll } from "./AnimateOnScroll";

export function CTASection() {
  return (
    <section className="py-32 lg:py-40">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <AnimateOnScroll>
          <h2 className="heading-page text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-8">
            Tu tienda online
            <br />
            <span className="text-gradient-nexora">con vendedor incluido.</span>
          </h2>

          <p className="text-lg text-text-muted mb-12 max-w-md mx-auto">
            Cargá lo que vendés y la IA se encarga del resto.
          </p>

          <a
            href={getGoogleAuthUrl()}
            className="group inline-flex items-center px-8 py-4 rounded-xl bg-white text-background font-semibold text-[15px] hover:bg-white/90 transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.08)]"
          >
            Crear mi tienda gratis
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </a>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
