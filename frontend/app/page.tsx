"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { getGoogleAuthUrl } from "@/lib/auth";
import { useAuth } from "@/app/providers/AuthProvider";
import "./landing.css";

import Icon, { type IconName } from "@/components/landing-v2/Icon";
import SmokeHero from "@/components/landing-v2/SmokeHero";
import HeroMockup from "@/components/landing-v2/HeroMockup";
import StepVisual from "@/components/landing-v2/StepVisual";
import MiniGlobe from "@/components/landing-v2/MiniGlobe";

/* ─────────── Datos ─────────── */

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "chat",
    title: "Agente IA que vende 24/7",
    desc: "Responde preguntas, recomienda productos y cierra ventas por vos. En WhatsApp, Instagram y tu tienda web.",
  },
  {
    icon: "sparkle",
    title: "Catálogo inteligente",
    desc: "Subís tus productos una sola vez. La IA genera descripciones, precios sugeridos y los publica en todos tus canales.",
  },
  {
    icon: "bolt",
    title: "Checkout en un click",
    desc: "Tus clientes pagan sin salir del chat. Integrado con Mercado Pago, transferencia y tarjetas.",
  },
  {
    icon: "chart",
    title: "Analytics en tiempo real",
    desc: "Ventas, conversión, productos top y performance del agente. Todo en un solo lugar, fácil de leer.",
  },
  {
    icon: "layers",
    title: "Multi-canal unificado",
    desc: "WhatsApp, Instagram DM, Mercado Libre y tu tienda web. Un solo inbox, un solo stock, un solo cliente.",
  },
  {
    icon: "shield",
    title: "Control total",
    desc: "Editás el tono, las respuestas y las reglas del agente. Tu marca, tus decisiones. La IA ejecuta.",
  },
];

const STEPS = [
  {
    title: "Subí tus productos",
    desc: "Importá desde Excel, Shopify o cargá manualmente. La IA completa fotos, descripciones y categorías automáticamente.",
  },
  {
    title: "Entrená a tu agente",
    desc: "Definí tono, políticas de envío, métodos de pago y horarios. En 5 minutos tu agente está listo para vender.",
  },
  {
    title: "Conectá tus canales",
    desc: "WhatsApp Business, Instagram, Mercado Libre y tu tienda web. Un clic y todo queda sincronizado.",
  },
  {
    title: "Vendé mientras dormís",
    desc: "El agente responde, recomienda y cobra. Vos recibís el dinero y te dedicás a crecer tu negocio.",
  },
];

const CASES: { icon: IconName; title: string; desc: string; stat: string }[] = [
  { icon: "store", title: "Retail & moda", desc: "Gestioná talles, stock y recomendaciones personalizadas por cliente.", stat: "+34% conversión" },
  { icon: "coffee", title: "Gastronomía", desc: "Recibí pedidos por WhatsApp, organizá la cocina y coordiná el delivery.", stat: "-60% tiempo" },
  { icon: "scissors", title: "Servicios", desc: "Reservas, consultas y pagos automáticos sin mover un dedo.", stat: "24/7 activo" },
  { icon: "tag", title: "E-commerce", desc: "Convertí visitantes en compradores con asistencia inteligente en cada paso.", stat: "3x ventas" },
];

const TESTIMONIALS = [
  { name: "Lucía Fernández", role: "Fundadora, Sastra", quote: "Agentro me devolvió las noches. El agente atiende mientras duermo y las ventas se duplicaron en 2 meses.", avatar: "LF" },
  { name: "Martín Rojas", role: "Café Cordillera", quote: "Pasamos de perder pedidos por WhatsApp a tener la cocina organizada. Ahora procesamos 3x más sin sumar gente.", avatar: "MR" },
  { name: "Camila Prieto", role: "Tienda Lumen", quote: "Pensé que iba a ser frío, pero los clientes no notan la diferencia. Responde mejor que yo a la madrugada.", avatar: "CP" },
  { name: "Diego Arriaga", role: "Mundo Fit", quote: "Probamos 4 chatbots antes. Agentro es el primero que realmente vende, no solo contesta preguntas.", avatar: "DA" },
  { name: "Sofía Mendez", role: "Flores Nativas", quote: "La IA recomienda productos que ni yo sabía que combinaban. Ticket promedio arriba 28%.", avatar: "SM" },
  { name: "Tomás Benítez", role: "ElectroHogar", quote: "Lo configuré un domingo a la tarde. El lunes ya estaba cerrando ventas por Instagram automáticamente.", avatar: "TB" },
  { name: "Valentina Ortiz", role: "Kiosco Norte", quote: "Creí que era para empresas grandes. Soy un kiosco y me cambió el día a día completamente.", avatar: "VO" },
  { name: "Nicolás Vargas", role: "Óptica Visión+", quote: "El analytics me mostró qué productos empujar. Nunca había tomado decisiones con datos así.", avatar: "NV" },
];

type Plan = {
  name: string;
  price: number;
  desc: string;
  features: string[];
  cta: string;
  href: string;
  featured: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: 0,
    desc: "Para probar Agentro sin compromiso.",
    features: ["Hasta 50 pedidos/mes", "1 canal de venta", "Agente IA básico", "Soporte por email"],
    cta: "Empezar gratis",
    href: "__signup__",
    featured: false,
  },
  {
    name: "Growth",
    price: 29,
    desc: "Para negocios que quieren crecer en serio.",
    features: ["Pedidos ilimitados", "Todos los canales", "Agente IA personalizable", "Analytics avanzado", "Soporte prioritario"],
    cta: "Probar 14 días gratis",
    href: "__signup__",
    featured: true,
  },
  {
    name: "Scale",
    price: 79,
    desc: "Para marcas con volumen y equipo.",
    features: ["Todo de Growth", "Multi-usuario", "API y webhooks", "Integraciones custom", "Account manager dedicado"],
    cta: "Hablar con ventas",
    href: "mailto:hola@getagentro.com",
    featured: false,
  },
];

/* ─────────── Hooks ─────────── */

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".landing-root .reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useCountUp(target: number, duration: number, startOn: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!startOn) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startOn, target, duration]);
  return val;
}

/* ─────────── Animated headline ─────────── */

function AnimatedHeadline() {
  const words = [
    { t: "Creá", hl: false, br: false },
    { t: "tu", hl: false, br: false },
    { t: "tienda", hl: false, br: false },
    { t: "online.", hl: false, br: true },
    { t: "La", hl: true, br: false },
    { t: "IA", hl: true, br: false },
    { t: "vende", hl: true, br: false },
    { t: "por", hl: true, br: false },
    { t: "vos.", hl: true, br: false },
  ];
  return (
    <h1>
      {words.map((w, i) => (
        <span key={i}>
          <span className="word" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
            <span className={w.hl ? "hl" : ""}>{w.t}</span>
          </span>
          {w.br ? <br /> : " "}
        </span>
      ))}
    </h1>
  );
}

/* ─────────── Feature card ─────────── */

function FeatureCard({
  f,
  i,
}: {
  f: { icon: IconName; title: string; desc: string };
  i: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      className="feature reveal"
      onMouseMove={onMove}
      style={{ transitionDelay: `${i * 0.05}s` }}
    >
      <span className="feature-index">{String(i + 1).padStart(2, "0")}</span>
      {i === 4 ? (
        <div style={{ alignSelf: "flex-start", marginBottom: 4 }}>
          <MiniGlobe size={76} />
        </div>
      ) : (
        <div className="feature-icon"><Icon name={f.icon} size={18} /></div>
      )}
      <div className="feature-title">{f.title}</div>
      <p className="feature-desc">{f.desc}</p>
    </div>
  );
}

/* ─────────── How it works ─────────── */

function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.innerHeight / 2;
      let best = 0;
      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top < y) best = i;
      });
      setActive(best);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="como" className="section">
      <div className="container">
        <div className="section-head reveal">
          <span className="kicker"><span className="dot" /> Cómo funciona</span>
          <h2>De cero a vendiendo en minutos.</h2>
          <p>Cuatro pasos. Sin equipo técnico, sin configuraciones complicadas. Agentro se ocupa del resto.</p>
        </div>

        <div className="steps">
          <div className="step-list">
            {STEPS.map((s, i) => (
              <div
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                className={`step ${active === i ? "active" : ""}`}
                data-num={String(i + 1).padStart(2, "0")}
                onMouseEnter={() => setActive(i)}
              >
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="step-visual">
            <StepVisual step={active} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Stats banner ─────────── */

function StatsBanner() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setVisible(true)),
      { threshold: 0.4 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const n1 = useCountUp(2400, 2000, visible);
  const n2 = useCountUp(94, 2000, visible);
  const n3 = useCountUp(37, 2000, visible);

  const items = [
    { v: n1, suf: "+", label: "Negocios usando Agentro" },
    { v: n2, suf: "%", label: "Respuestas automatizadas" },
    { v: n3, suf: "%", label: "Aumento promedio en ventas" },
  ];

  return (
    <section ref={ref} className="stats-banner">
      <div className="container">
        <div className="stats-banner-grid">
          {items.map((s, i) => (
            <div key={i} className="stats-banner-item">
              <div className="stats-banner-num">
                {s.v.toLocaleString("es-AR")}
                <span className="suf">{s.suf}</span>
              </div>
              <div className="stats-banner-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Testimonials marquee ─────────── */

function TestimonialCard({ t }: { t: (typeof TESTIMONIALS)[number] }) {
  return (
    <div className="testimonial-card">
      <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
      <div className="testimonial-author">
        <div className="testimonial-avatar">{t.avatar}</div>
        <div>
          <div className="testimonial-name">{t.name}</div>
          <div className="testimonial-role">{t.role}</div>
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  const row1 = [...TESTIMONIALS.slice(0, 4), ...TESTIMONIALS.slice(0, 4)];
  const row2 = [...TESTIMONIALS.slice(4), ...TESTIMONIALS.slice(4)];
  return (
    <section className="section testimonials-section">
      <div className="container">
        <div className="section-head reveal">
          <span className="kicker"><span className="dot" /> Testimonios</span>
          <h2>Negocios reales.<br />Resultados reales.</h2>
          <p>Más de 2.400 emprendedores ya venden con Agentro. Estas son algunas de sus historias.</p>
        </div>
      </div>
      <div className="marquee-wrap reveal">
        <div className="marquee marquee-left">
          {row1.map((t, i) => <TestimonialCard key={`r1-${i}`} t={t} />)}
        </div>
        <div className="marquee marquee-right">
          {row2.map((t, i) => <TestimonialCard key={`r2-${i}`} t={t} />)}
        </div>
      </div>
    </section>
  );
}

/* ─────────── Avatar ─────────── */

function UserAvatar({
  user,
}: {
  user: { full_name: string | null; email: string; avatar_url?: string | null };
}) {
  const [imgError, setImgError] = useState(false);
  const initial = (user.full_name || user.email).charAt(0).toUpperCase();
  if (user.avatar_url && !imgError) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1px solid var(--border-2)",
        }}
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--accent), var(--navy-2))",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontFamily: "var(--mono)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {initial}
    </div>
  );
}

/* ─────────── Page ─────────── */

export default function LandingPage() {
  useReveal();
  const { user, isLoading } = useAuth();

  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Parallax on the hero mockup
  const mockupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (!mockupRef.current) return;
      const y = window.scrollY;
      mockupRef.current.style.transform = `translateY(${y * 0.15}px) perspective(1800px) rotateX(${Math.max(0, 8 - y * 0.02)}deg)`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onLogoMove = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / r.width;
    const y = (e.clientY - r.top - r.height / 2) / r.height;
    const img = el.querySelector("img");
    if (img) img.style.transform = `perspective(1000px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg)`;
  };
  const onLogoLeave = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    const img = e.currentTarget.querySelector("img");
    if (img) img.style.transform = "perspective(1000px) rotateX(0) rotateY(0)";
  };

  const signupHref = getGoogleAuthUrl();
  const planHref = (h: string) => (h === "__signup__" ? signupHref : h);

  const kickerStyle: CSSProperties = { opacity: 0, animation: "lp-rise .7s .1s cubic-bezier(.2,.8,.2,1) forwards" };

  return (
    <div className="landing-root">
      {/* NAV */}
      <nav className={`lp-nav ${navScrolled ? "scrolled" : ""}`}>
        <div className="container nav-inner">
          <a href="#" className="logo">
            <div className="logo-mark" />
            <span>Agentro</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#como">Cómo funciona</a>
            <a href="#casos">Casos de uso</a>
            <a href="#precios">Precios</a>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {isLoading ? (
              <div style={{ width: 96, height: 32, borderRadius: 100, background: "rgba(255,255,255,0.06)" }} />
            ) : user ? (
              <Link
                href="/app"
                className="btn btn-ghost"
                style={{ padding: "8px 14px", gap: 10 }}
              >
                <UserAvatar user={user} />
                <span style={{ fontSize: 13 }}>
                  {user.full_name || user.email.split("@")[0]}
                </span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost">Entrar</Link>
                <a href={signupHref} className="btn btn-primary">
                  Empezar gratis <Icon name="arrow" size={14} className="arrow" />
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <SmokeHero />
        <div className="hero-grid" />
        <div className="container hero-inner">
          <a href="#" className="hero-logo" onMouseMove={onLogoMove} onMouseLeave={onLogoLeave}>
            <div className="hero-logo-ring" />
            <img src="/agentro-white.png" alt="Agentro" />
          </a>
          <span className="kicker" style={kickerStyle}>
            <span className="dot" /> Nuevo · Agente IA v2.0
          </span>
          <AnimatedHeadline />
          <p className="hero-sub">
            El primer asistente de ventas con IA para pequeños negocios. Responde, recomienda y cobra por vos — en todos tus canales.
          </p>
          <div className="hero-cta">
            <a href={signupHref} className="btn btn-primary btn-lg">
              Empezar gratis <Icon name="arrow" size={14} className="arrow" />
            </a>
            <a href="#demo" className="btn btn-ghost btn-lg">Ver demo</a>
          </div>
          <div className="hero-meta">
            <span><Icon name="check" size={12} /> Sin tarjeta</span>
            <span><Icon name="check" size={12} /> Listo en 5 min</span>
            <span><Icon name="check" size={12} /> Cancelás cuando quieras</span>
          </div>

          <div ref={mockupRef} className="mockup-wrap" id="demo">
            <HeroMockup />
          </div>
        </div>
      </section>

      <StatsBanner />

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> Features</span>
            <h2>Todo lo que necesitás<br />para vender sin frenar.</h2>
            <p>Agentro reemplaza cinco herramientas distintas. Un solo login, un solo dashboard, un solo precio.</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f, i) => <FeatureCard key={i} f={f} i={i} />)}
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* USE CASES */}
      <section id="casos" className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> Casos de uso</span>
            <h2>Hecho para tu tipo de negocio.</h2>
            <p>Sea lo que sea que vendas, Agentro se adapta. Configurás una vez y la IA aprende de tus ventas.</p>
          </div>
          <div className="cases">
            {CASES.map((c, i) => (
              <div key={i} className="case reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
                <div>
                  <div className="case-emoji"><Icon name={c.icon} size={18} /></div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
                <div className="case-stat">— {c.stat}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> Precios</span>
            <h2>Simple. Sin sorpresas.</h2>
            <p>Empezá gratis. Cuando tu negocio crezca, Agentro crece con vos. Sin contratos, sin letra chica.</p>
          </div>
          <div className="pricing">
            {PLANS.map((p, i) => (
              <div
                key={i}
                className={`plan reveal ${p.featured ? "featured" : ""}`}
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                {p.featured && <div className="plan-tag">Más popular</div>}
                <div>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price">
                    <span className="amount">${p.price}</span>
                    <span className="period">USD / mes</span>
                  </div>
                  <p className="plan-desc">{p.desc}</p>
                </div>
                <ul className="plan-features">
                  {p.features.map((feat, j) => (
                    <li key={j}><Icon name="check" size={14} /> {feat}</li>
                  ))}
                </ul>
                <a
                  href={planHref(p.href)}
                  className={`btn ${p.featured ? "btn-primary" : "btn-ghost"} btn-lg`}
                  style={{ justifyContent: "center" }}
                >
                  {p.cta} <Icon name="arrow" size={14} className="arrow" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Testimonials />

      {/* CTA FINAL */}
      <section className="cta-final">
        <div className="container">
          <span className="kicker reveal" style={{ marginBottom: 24 }}>
            <span className="dot" /> Empezá hoy
          </span>
          <h2 className="reveal">Tu próxima venta<br />puede ser en 5 minutos.</h2>
          <p className="reveal delay-1">Configurá Agentro, conectá WhatsApp y dejá que la IA haga el resto. Sin tarjeta, sin compromiso.</p>
          <a href={signupHref} className="btn btn-primary btn-lg reveal delay-2">
            Crear mi tienda gratis <Icon name="arrow" size={16} className="arrow" />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="container footer-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="logo-mark" />
            <span>Agentro © {new Date().getFullYear()}</span>
          </div>
          <div className="footer-links">
            <Link href="/terms">Términos</Link>
            <Link href="/privacy">Privacidad</Link>
            <a href="mailto:hola@getagentro.com">Contacto</a>
            <a href="#">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
