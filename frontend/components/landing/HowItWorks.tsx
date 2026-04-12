"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

const steps = [
  {
    num: "01",
    title: "Creá tu tienda",
    desc: "Elegí un nombre y un diseño. En minutos ya está online y lista para recibir visitas.",
  },
  {
    num: "02",
    title: "Cargá tus productos",
    desc: "Subí fotos, precios y stock. La IA aprende automáticamente cada producto que cargás.",
  },
  {
    num: "03",
    title: "La IA vende sola",
    desc: "Un cliente pregunta, la IA responde con precios y stock real. Recomienda, ofrece y cierra ventas.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-32 lg:py-40">
      <div className="max-w-5xl mx-auto px-6">
        <AnimateOnScroll>
          <p className="text-[13px] text-text-muted tracking-wide uppercase mb-4">Cómo funciona</p>
          <h2 className="heading-page text-4xl sm:text-5xl mb-20">
            Tres pasos. Cero complicaciones.
          </h2>
        </AnimateOnScroll>

        <div className="space-y-0">
          {steps.map((step, i) => (
            <AnimateOnScroll key={step.num} delay={i * 100}>
              <div className="group grid grid-cols-[auto_1fr] gap-8 sm:gap-12 py-12 border-t border-white/[0.06] last:border-b">
                <span className="text-4xl sm:text-5xl font-display font-bold text-white/[0.08] group-hover:text-primary/30 transition-colors duration-500 pt-1">
                  {step.num}
                </span>
                <div>
                  <h3 className="heading-section text-xl sm:text-2xl mb-3">{step.title}</h3>
                  <p className="text-text-muted leading-relaxed max-w-lg">{step.desc}</p>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
