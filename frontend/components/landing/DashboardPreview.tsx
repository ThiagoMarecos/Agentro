"use client";

import { AnimateOnScroll } from "./AnimateOnScroll";

export function DashboardPreview() {
  return (
    <section className="py-32 lg:py-40 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/[0.05] rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <AnimateOnScroll>
          <div className="text-center mb-16">
            <p className="text-[13px] text-text-muted tracking-wide uppercase mb-4">Tu panel</p>
            <h2 className="heading-page text-4xl sm:text-5xl">
              Todo desde un solo lugar
            </h2>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll delay={150}>
          <div className="rounded-2xl border border-white/[0.08] bg-surface/50 overflow-hidden shadow-2xl shadow-black/20">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              </div>
            </div>

            <div className="flex min-h-[340px]">
              {/* Sidebar */}
              <aside className="w-44 border-r border-white/[0.06] py-4 px-3 space-y-0.5 hidden md:block">
                {[
                  { label: "Panel", active: true },
                  { label: "Productos", active: false },
                  { label: "Pedidos", active: false },
                  { label: "Clientes", active: false },
                  { label: "Agente IA", active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`text-[13px] py-2 px-3 rounded-lg ${
                      item.active ? "bg-white/[0.06] text-text-primary" : "text-text-muted/60"
                    }`}
                  >
                    {item.label}
                  </div>
                ))}
              </aside>

              {/* Main */}
              <main className="flex-1 p-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Productos", val: "48" },
                    { label: "Pedidos", val: "12" },
                    { label: "Clientes", val: "156" },
                    { label: "Ventas IA", val: "$4.2k" },
                  ].map((s) => (
                    <div key={s.label} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                      <div className="text-[11px] text-text-muted mb-1">{s.label}</div>
                      <div className="text-lg font-semibold">{s.val}</div>
                    </div>
                  ))}
                </div>

                <div className="grid lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="text-[13px] font-medium mb-3">Actividad</div>
                    <div className="space-y-3">
                      {[
                        { t: "Venta cerrada por IA", c: "text-accent" },
                        { t: "Nuevo pedido #1042", c: "text-primary" },
                        { t: "Cliente registrado", c: "text-text-muted" },
                      ].map((a) => (
                        <div key={a.t} className="flex items-center gap-2">
                          <div className={`w-1 h-1 rounded-full ${a.c.replace("text-", "bg-")}`} />
                          <span className={`text-xs ${a.c}`}>{a.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="lg:col-span-2 p-4 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="text-[13px] font-medium mb-3">Agente IA</div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                      <span className="text-xs text-accent">Activo</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Chats hoy</span>
                        <span>23</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-muted">Ventas</span>
                        <span>7</span>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
