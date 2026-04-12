"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

export function StatsBar() {
  return (
    <AnimateOnScroll>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        <div className="grid grid-cols-3 py-16">
          {[
            { value: "3 min", sub: "para crear tu tienda" },
            { value: "24/7", sub: "IA vendiendo por vos" },
            { value: "0", sub: "código necesario" },
          ].map((s) => (
            <div key={s.sub} className="text-center">
              <div className="text-3xl sm:text-4xl font-display font-bold text-text-primary mb-2">{s.value}</div>
              <div className="text-[13px] text-text-muted">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>
    </AnimateOnScroll>
  );
}
