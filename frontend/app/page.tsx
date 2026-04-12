"use client";

import Link from "next/link";
import { useState } from "react";
import { getGoogleAuthUrl } from "@/lib/auth";
import { useAuth } from "@/app/providers/AuthProvider";

function UserAvatar({ user }: { user: { full_name: string | null; email: string; avatar_url?: string | null } }) {
  const [imgError, setImgError] = useState(false);
  const initial = (user.full_name || user.email).charAt(0).toUpperCase();

  if (user.avatar_url && !imgError) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="w-8 h-8 rounded-full object-cover border border-gray-200"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-semibold">
      {initial}
    </div>
  );
}

/* ═══════════════════════════════════════════
   NAVBAR — glass flotante, muestra usuario si está logueado
   ═══════════════════════════════════════════ */
function Navbar() {
  const { user, isLoading } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-black/[0.04]">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/">
          <img src="/logo-green.png" alt="Agentro" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="w-24 h-8 rounded-full bg-gray-100 animate-pulse" />
          ) : user ? (
            <Link href="/app" className="flex items-center gap-3 px-4 py-2 rounded-full hover:bg-gray-100 transition-all">
              <UserAvatar user={user} />
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user.full_name || user.email.split("@")[0]}
              </span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition px-4 py-2">
                Iniciar sesión
              </Link>
              <a
                href={getGoogleAuthUrl()}
                className="text-sm font-medium px-5 py-2.5 rounded-full bg-white/80 text-gray-900 border border-gray-200/60 backdrop-blur-xl btn-glass-glow-light"
              >
                Empezar gratis
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

/* ═══════════════════════════════════════════
   HERO — pantalla completa, blobs de color
   para glassmorphism, badge + CTA en glass
   ═══════════════════════════════════════════ */
const SLIDER_PRODUCTS = [
  { img: "/slider/slider-hoodie.png", label: "Ropa" },
  { img: "/slider/slider-burger.png", label: "Gastronomía" },
  { img: "/slider/slider-earbuds.png", label: "Electrónica" },
  { img: "/slider/slider-sneakers.png", label: "Calzado" },
  { img: "/slider/slider-lipstick.png", label: "Belleza" },
  { img: "/slider/slider-coffee.png", label: "Café" },
  { img: "/slider/slider-mouse.png", label: "Gaming" },
  { img: "/slider/slider-serum.png", label: "Skincare" },
];

function ProductSlider() {
  const items = [...SLIDER_PRODUCTS, ...SLIDER_PRODUCTS, ...SLIDER_PRODUCTS, ...SLIDER_PRODUCTS];
  return (
    <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden pointer-events-none z-0">
      <div
        className="flex gap-10 items-end pb-8"
        style={{ animation: "scrollLeft 50s linear infinite", width: "max-content" }}
      >
        {items.map((p, i) => (
          <div key={`${p.label}-${i}`} className="flex-shrink-0 flex flex-col items-center gap-3 opacity-15">
            <div className="w-[160px] h-[160px] rounded-3xl bg-gray-50/60 border border-gray-200/40 flex items-center justify-center p-4 overflow-hidden">
              <img src={p.img} alt={p.label} className="w-full h-full object-contain" />
            </div>
            <span className="text-sm text-gray-400 font-medium">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="bg-white min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Blobs de color */}
      <div className="absolute top-[15%] left-[10%] w-[400px] h-[400px] bg-indigo-300/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-violet-300/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[250px] h-[250px] bg-cyan-200/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Slider de productos en el fondo */}
      <ProductSlider />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Badge glass */}
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/50 backdrop-blur-xl border border-white/60 shadow-lg shadow-indigo-500/5 text-sm text-indigo-600 font-medium mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          E-commerce + Inteligencia Artificial
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-gray-900 leading-[1.05] tracking-tight mb-6">
          Creá tu tienda online.
          <br />
          <span className="text-gradient-animated">
            La IA vende por vos.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
          Armá tu tienda en minutos, cargá tus productos y un agente de IA
          los aprende para atender clientes y cerrar ventas. Automático. 24/7.
        </p>

        {/* CTA en card glass */}
        <div className="inline-flex flex-col sm:flex-row items-center gap-3 p-2 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-xl shadow-gray-900/5">
          <a
            href={getGoogleAuthUrl()}
            className="group px-8 py-4 rounded-xl bg-white/70 text-gray-900 font-semibold text-base border border-gray-200/60 backdrop-blur-xl btn-glass-glow-light"
          >
            Crear mi tienda gratis
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </a>
          <a
            href="#como-funciona"
            className="px-8 py-4 rounded-xl bg-white/40 text-gray-600 font-medium text-base border border-gray-200/40 backdrop-blur-xl btn-glass-glow-light"
          >
            ¿Cómo funciona?
          </a>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          Gratis para empezar · Sin tarjeta · Lista en 3 minutos
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   TIENDAS EJEMPLO — pantalla completa, oscuro
   Cards con glass sobre blobs de color
   ═══════════════════════════════════════════ */
function StoreExamples() {
  const stores = [
    { name: "Urban Style", type: "Moda", color: "from-indigo-500 to-violet-500", items: ["Remeras", "Zapatillas", "Gorras", "Hoodies"] },
    { name: "Sabores Express", type: "Delivery", color: "from-orange-500 to-red-500", items: ["Hamburguesas", "Pizzas", "Empanadas", "Postres"] },
    { name: "TechStore", type: "Electrónica", color: "from-cyan-500 to-blue-500", items: ["Auriculares", "Cargadores", "Fundas", "Cables"] },
  ];

  return (
    <section className="bg-gray-950 min-h-screen flex items-center relative overflow-hidden">
      {/* Blobs para glass en modo oscuro */}
      <div className="absolute top-[20%] left-[5%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[10%] w-[350px] h-[350px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            Cualquier negocio. Una sola plataforma.
          </h2>
          <p className="text-gray-400 text-lg">
            Ropa, comida, electrónica, servicios – creá la tienda que necesités.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div key={store.name} className="group rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] p-1 hover:bg-white/[0.1] hover:border-white/[0.15] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-white/5">
              <div className={`rounded-xl bg-gradient-to-br ${store.color} p-5 mb-1`}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white font-semibold text-sm">{store.name}</span>
                  <span className="text-white/70 text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">{store.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {store.items.map((item) => (
                    <div key={item} className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
                      <div className="h-8 rounded bg-white/10 mb-1.5" />
                      <span className="text-white/80 text-[11px]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-500">IA atendiendo clientes</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   CÓMO FUNCIONA — pantalla completa, blanco
   Cards con glass
   ═══════════════════════════════════════════ */
function HowItWorks() {
  const steps = [
    {
      title: "Creá tu tienda",
      desc: "Elegí nombre, diseño y listo. Online en minutos.",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    },
    {
      title: "Cargá productos",
      desc: "Subí fotos, precios, stock. La IA aprende cada producto.",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    },
    {
      title: "La IA vende por vos",
      desc: "Atiende clientes, recomienda y cierra ventas. 24/7.",
      icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
    },
  ];

  return (
    <section id="como-funciona" className="bg-gray-50 min-h-screen flex items-center relative overflow-hidden">
      {/* Blob sutil */}
      <div className="absolute top-[30%] right-[15%] w-[300px] h-[300px] bg-indigo-200/30 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 mb-3">
            Tres pasos. Cero complicaciones.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="text-center p-8 rounded-2xl bg-white/60 backdrop-blur-xl border border-white/80 shadow-lg shadow-gray-900/[0.03] hover:shadow-xl hover:-translate-y-1 transition-all duration-500">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">{step.icon}</svg>
              </div>
              <div className="text-sm text-indigo-500 font-medium mb-2">Paso {i + 1}</div>
              <h3 className="text-xl font-display font-semibold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   DEMO IA — pantalla completa, oscuro
   Chat con glass
   ═══════════════════════════════════════════ */
function AIDemo() {
  return (
    <section className="bg-gray-950 min-h-screen flex items-center relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute top-[20%] left-[5%] w-[350px] h-[350px] bg-green-500/8 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[5%] w-[300px] h-[300px] bg-indigo-500/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] text-green-400 text-sm font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Inteligencia Artificial
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4 leading-tight">
              Tu agente conoce
              <br />cada producto que cargás.
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8">
              Subís un producto con precio, stock y descripción. La IA lo aprende al instante.
              Cuando un cliente pregunta, responde con datos reales de tu tienda.
            </p>
            <ul className="space-y-4">
              {[
                "Responde precios y disponibilidad",
                "Recomienda productos similares",
                "Cierra ventas automáticamente",
                "Funciona 24 horas, todos los días",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat glass */}
          <div className="rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] overflow-hidden shadow-2xl shadow-black/20">
            <div className="px-5 py-3 border-b border-white/[0.08] flex items-center gap-2 bg-white/[0.03]">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-sm font-medium text-white">Chat de tu tienda</span>
              <span className="text-xs text-gray-500 ml-auto">IA activa</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-end">
                <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                  <p className="text-sm text-gray-200">¿Tienen la remera oversize en talle L?</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-indigo-500/15 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%] border border-indigo-500/10">
                  <p className="text-xs text-indigo-300 font-medium mb-1">Agentro IA</p>
                  <p className="text-sm text-gray-200">
                    ¡Hola! Sí, la <strong className="text-white">Remera Oversize</strong> talle L está disponible.
                    Precio: <strong className="text-white">$4.500</strong>. Hay 23 en stock. ¿La agrego al carrito?
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl rounded-br-md px-4 py-2.5">
                  <p className="text-sm text-gray-200">Dale, sí!</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-green-500/15 backdrop-blur-sm border border-green-500/15 rounded-2xl rounded-bl-md px-4 py-2.5">
                  <p className="text-sm text-green-300 font-medium">✓ Agregado al carrito · $4.500</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FEATURES — pantalla completa, blanco
   Cards con glass
   ═══════════════════════════════════════════ */
function Features() {
  const features = [
    { title: "Tu tienda en minutos", desc: "Sin programar. Elegí diseño, cargá productos, listo.", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /> },
    { title: "Panel de control", desc: "Pedidos, clientes, stock y métricas. Todo en un lugar.", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /> },
    { title: "Diseños profesionales", desc: "Plantillas listas. Tu tienda se ve premium desde el día uno.", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /> },
    { title: "Seguro y privado", desc: "Cada tienda aislada. Tus datos protegidos.", icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
  ];

  return (
    <section className="bg-white min-h-screen flex items-center relative overflow-hidden">
      {/* Blob */}
      <div className="absolute bottom-[20%] left-[10%] w-[300px] h-[300px] bg-violet-200/25 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-24 lg:py-32 w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 mb-3">
            Todo lo que necesitás para vender.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="text-center p-8 rounded-2xl bg-white/50 backdrop-blur-xl border border-gray-200/60 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-500">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5 mx-auto">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">{f.icon}</svg>
              </div>
              <h3 className="font-display font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   CTA FINAL — pantalla completa, oscuro
   Card glass grande
   ═══════════════════════════════════════════ */
function CTA() {
  return (
    <section className="bg-gray-950 min-h-screen flex items-center relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute top-[30%] left-[20%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[350px] h-[350px] bg-violet-500/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 py-24 lg:py-32 w-full">
        <div className="rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/[0.1] p-12 lg:p-20 text-center shadow-2xl shadow-black/20">
          <h2 className="text-4xl sm:text-5xl font-display font-bold text-white leading-tight mb-6">
            Empezá a vender
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              hoy mismo.
            </span>
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-md mx-auto">
            Creá tu tienda, cargá productos y la IA se encarga del resto.
          </p>
          <a
            href={getGoogleAuthUrl()}
            className="group inline-flex items-center px-8 py-4 rounded-xl bg-white/80 text-gray-900 font-semibold text-base border border-white/40 backdrop-blur-xl btn-glass-glow"
          >
            Crear mi tienda gratis
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </a>
          <p className="mt-6 text-sm text-gray-500">Sin tarjeta · Sin código · Lista en minutos</p>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-10">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <span className="text-sm text-gray-400">© {new Date().getFullYear()} Agentro</span>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600 transition">Privacidad</Link>
          <Link href="/terms" className="hover:text-gray-600 transition">Términos</Link>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ colorScheme: "light" }}>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <StoreExamples />
        <AIDemo />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
