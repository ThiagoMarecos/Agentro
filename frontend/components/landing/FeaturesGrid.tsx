"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

const features = [
  {
    title: "IA que conoce tu catálogo",
    desc: "Cargás productos y la IA los aprende. Sabe precios, stock y variantes.",
  },
  {
    title: "Atiende clientes sola",
    desc: "Tu agente responde preguntas, recomienda productos y cierra ventas 24/7.",
  },
  {
    title: "Tu tienda profesional",
    desc: "Diseños listos para usar. Online en minutos sin tocar código.",
  },
  {
    title: "Panel de control",
    desc: "Pedidos, clientes, stock y métricas en un solo lugar.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="caracteristicas" className="py-32 lg:py-40">
      <div className="max-w-5xl mx-auto px-6">
        <AnimateOnScroll>
          <p className="text-[13px] text-text-muted tracking-wide uppercase mb-4">Características</p>
          <h2 className="heading-page text-4xl sm:text-5xl mb-16">
            Todo lo que necesitás para vender.
          </h2>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
          {features.map((f, i) => (
            <AnimateOnScroll key={f.title} delay={i * 80}>
              <div className="bg-background p-10 sm:p-12 hover:bg-white/[0.02] transition-colors duration-500">
                <h3 className="heading-section text-lg mb-3">{f.title}</h3>
                <p className="text-text-muted text-[15px] leading-relaxed">{f.desc}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
