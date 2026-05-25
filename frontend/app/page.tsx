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

/* ─────────── Datos ─────────── */

const FEATURES: { icon: IconName; title: string; desc: string; tag: string }[] = [
  {
    icon: "chat",
    title: "Vendedor de IA 24/7",
    desc: "Atiende cada DM como vos lo harías. Pregunta, recomienda combos, junta los datos y te pasa el cliente caliente, listo para cobrar.",
    tag: "WHATSAPP",
  },
  {
    icon: "store",
    title: "Tu tienda online incluida",
    desc: "Storefront pública en getagentro.com/tu-marca. Catálogo navegable, variantes y stock — sin diseñador ni desarrollador.",
    tag: "TIENDA WEB",
  },
  {
    icon: "tag",
    title: "Caja para tu local",
    desc: "POS de mostrador con apertura y cierre de caja, cliente walk-in, atajos de teclado y ticket imprimible al instante.",
    tag: "PUNTO DE VENTA",
  },
  {
    icon: "shield",
    title: "Equipo + copiloto humano",
    desc: "Sumás vendedores con su propio acceso. Cuando uno toma el chat, la IA pausa al toque — sin pisarse, sin choque.",
    tag: "EQUIPO",
  },
  {
    icon: "layers",
    title: "Inbox unificado",
    desc: "WhatsApp y storefront en una sola bandeja. Pipeline kanban por etapa, asignación a vendedor, take-control con un click.",
    tag: "BANDEJA",
  },
  {
    icon: "sparkle",
    title: "Catálogo con superpoderes",
    desc: "Variantes por talle y color, fotos múltiples, stock con backorder. Importás desde Excel, CSV o una URL externa.",
    tag: "PRODUCTOS",
  },
];

const PROBLEMS = [
  { quote: "Atiendo el WhatsApp en el subte, entre clientes, a la noche. Si no contesto en 2 minutos, pierdo la venta.", who: "Dueño · retail" },
  { quote: "Probé tres chatbots. Todos suenan a robot, el cliente se da cuenta y se va. No quiero un Q&A automático.", who: "Dueña · gastro" },
  { quote: "Tengo storefront, WhatsApp y caja física separados. Stock en uno, pedidos en otro. Es un caos.", who: "Dueño · e-commerce" },
];

const STEPS = [
  {
    title: "Pedí tu invitación",
    desc: "Estamos en beta cerrada. Te respondemos en 24hs, te damos acceso con Google y reservás tu subdominio en getagentro.com/tu-marca.",
  },
  {
    title: "Cargá tu catálogo",
    desc: "Subís productos manualmente, importás desde Excel/CSV o scrapeás una URL externa. Variantes, fotos y stock listos.",
  },
  {
    title: "Conectá tu WhatsApp",
    desc: "Vinculás tu WhatsApp Business en minutos. Mismo número, mismo historial — el agente arranca a atender al toque.",
  },
  {
    title: "Recibí clientes listos para cerrar",
    desc: "El agente trabaja siempre. Vos abrís el inbox y te encontrás con los pedidos pre-calificados — solo te queda cobrar.",
  },
];

const CASES: { icon: IconName; title: string; desc: string; stat: string }[] = [
  { icon: "store", title: "Ropa y moda", desc: "Variantes por talle y color, captura del talle en el chat, recomendaciones de combos en tiempo real.", stat: "Vendé sin estar" },
  { icon: "coffee", title: "Gastronomía", desc: "Pedidos por WhatsApp con menú variable, dirección y horario de retiro capturados de una.", stat: "Sin contratar más gente" },
  { icon: "scissors", title: "Servicios", desc: "Consultas, presupuestos y reservas. El agente filtra los curiosos y te pasa los clientes serios.", stat: "Filtra el ruido por vos" },
  { icon: "tag", title: "E-commerce", desc: "WhatsApp, tienda online y caja física conectados. Un solo stock, un solo cliente, un solo equipo.", stat: "Todo en un lugar" },
];

const DIFFS = [
  {
    title: "Pre-venta inteligente, no chatbot de FAQ.",
    desc: "La mayoría de los chatbots responden tres preguntas y se quedan colgados. El nuestro entiende qué busca el cliente, le recomienda combos, junta talle, color y dirección, y te lo deja servido con todo el contexto para que cierres la venta como si lo hubieras atendido vos.",
    bad: ["Bot que responde «si/no/horarios»", "Cliente que se aburre y se va", "Respuestas robot que matan la venta"],
    good: ["Pre-vende y recomienda combos", "Junta producto, datos y prioridad", "Te lo pasa listo para cobrar"],
  },
  {
    title: "Multi-canal real: WhatsApp, tienda online y caja.",
    desc: "Otros venden «omnicanal» y son tres dashboards distintos. Acá es una sola plataforma: lo que vendés en el mostrador descuenta del stock del WhatsApp y de la tienda web. Un cliente, un pedido, un solo lugar.",
    bad: ["3 herramientas distintas", "Stock desincronizado todo el tiempo", "Cliente repetido en cada sistema"],
    good: ["Un solo inbox, un solo stock", "Cliente único en todos los canales", "Caja, tienda y chat en una pantalla"],
  },
  {
    title: "Copiloto humano: la IA pausa cuando tomás control.",
    desc: "Cuando un vendedor del equipo entra al chat, el agente se hace a un costado. No hay choque, no hay respuestas pisadas, no hay que apagar nada. Vos terminás la venta y el agente sigue trabajando con el resto.",
    bad: ["IA y humano contestan a la vez", "Cliente recibe dos respuestas distintas", "Hay que apagar el bot manualmente"],
    good: ["Tomás el chat con un click", "IA pausa, humano cierra", "El agente vuelve cuando terminás"],
  },
];

const FAQS = [
  {
    q: "¿La IA cierra la venta sola?",
    a: "No. El agente pre-califica, recomienda, junta datos y arma el pedido. Cuando el cliente está listo para pagar, te lo pasa a vos (o a un vendedor del equipo) con todo el contexto — producto, variantes, datos personales, prioridad. El cierre lo hacés vos. Eso es a propósito: queremos que el cliente final hable con un humano, no que la IA tome decisiones de venta sin tu visto bueno.",
  },
  {
    q: "¿Necesito tener WhatsApp Business?",
    a: "Sí. Te conectás con tu cuenta de WhatsApp Business existente. No cambiás de número, no perdés el historial, y podés desconectarlo cuando quieras. Si todavía no tenés WhatsApp Business, te ayudamos a migrar tu número.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Mientras estemos en beta cerrada, Agentro es gratis. Al lanzamiento público vamos a anunciar el pricing con anticipación, y vos vas a tener un plan preferencial por haber estado desde el principio. No vas a despertarte un día con una factura sorpresa.",
  },
  {
    q: "¿En qué países funciona?",
    a: "Funciona en cualquier país donde haya WhatsApp Business. Hoy estamos enfocados en LATAM hispanohablante — Argentina, Paraguay, México, Chile y la región. Si tu país no está en el radar, decinos y lo evaluamos.",
  },
  {
    q: "¿Cuántos productos puedo tener?",
    a: "Pensado para catálogos de 10 a 500 productos — el sweet spot del pequeño y mediano negocio. Variantes por talle/color, fotos múltiples, stock y backorder vienen incluidos.",
  },
  {
    q: "¿Cómo aprende el agente sobre mi negocio?",
    a: "Levanta tu catálogo automáticamente y le agregás reglas: tono, políticas de envío, métodos de pago habilitados, productos prioritarios. Después afina su forma de hablar y vender con cada conversación — entre más lo usás, mejor entiende a tus clientes.",
  },
  {
    q: "¿Puedo tener varios vendedores en mi equipo?",
    a: "Sí. Podés sumar a todo tu equipo con accesos diferenciados, asignar conversaciones a cada vendedor y activar el modo copiloto (cuando el vendedor toma control del chat, la IA pausa al toque). Pensado para equipos de 1 a 20 personas.",
  },
  {
    q: "¿Qué pasa si el agente se equivoca?",
    a: "Honesto: a veces se equivoca. Por eso no le dejamos cerrar la venta sola. Vos ves todas las conversaciones en el inbox, podés tomar control en cualquier momento, y le enseñás correcciones para que no repita el error. La IA es buena haciendo el 80% del laburo aburrido — el 20% crítico te toca a vos.",
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

/* ─────────── Animated headline: "La IA vende. Vos cerrás." ─────────── */

function AnimatedHeadline() {
  const words = [
    { t: "La", hl: false, br: false },
    { t: "IA", hl: false, br: false },
    { t: "vende.", hl: false, br: true },
    { t: "Vos", hl: true, br: false },
    { t: "cerrás.", hl: true, br: false },
  ];
  return (
    <h1>
      {words.map((w, i) => (
        <span key={i}>
          <span className="word" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
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
  f: { icon: IconName; title: string; desc: string; tag: string };
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
      style={{ transitionDelay: `${i * 0.04}s` }}
    >
      <span className="feature-index">{f.tag}</span>
      <div className="feature-icon"><Icon name={f.icon} size={18} /></div>
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
          <h2>De cero a vendiendo,<br />sin equipo técnico.</h2>
          <p>Cuatro pasos y ya estás atendiendo. Sin tarjeta, sin instalaciones largas, sin manuales. El primer chat pre-calificado te llega el mismo día que conectás WhatsApp.</p>
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

/* ─────────── Channels strip ─────────── */

function ChannelsStrip() {
  return (
    <div className="channels-strip">
      <div className="channel-card reveal">
        <div className="channel-tag">CANAL · CHAT</div>
        <div className="channel-title">WhatsApp Business</div>
        <p className="channel-desc">Tu vendedor de IA atiende cada DM, pre-vende y arma la propuesta. Sin cambiar de número, sin perder el historial.</p>
        <div className="channel-list">
          <span>Pre-venta inteligente</span>
          <span>Recomendaciones en vivo</span>
          <span>Carrito acumulativo</span>
        </div>
      </div>
      <div className="channel-card reveal" style={{ transitionDelay: ".1s" }}>
        <div className="channel-tag">CANAL · WEB</div>
        <div className="channel-title">Tu tienda online</div>
        <p className="channel-desc">Lista en getagentro.com/tu-marca. Catálogo, variantes y pedidos sin tener que armar nada vos.</p>
        <div className="channel-list">
          <span>Subdominio incluido</span>
          <span>Catálogo navegable</span>
          <span>Pedidos desde la web</span>
        </div>
      </div>
      <div className="channel-card reveal" style={{ transitionDelay: ".2s" }}>
        <div className="channel-tag">CANAL · PRESENCIAL</div>
        <div className="channel-title">Caja para tu local</div>
        <p className="channel-desc">Punto de venta para mostrador. Apertura, cierre con cuadre, ticket imprimible y atajos para vender rápido.</p>
        <div className="channel-list">
          <span>Cliente walk-in</span>
          <span>Atajos de teclado</span>
          <span>Mismo stock que la web</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Differentiators ─────────── */

function Differentiators() {
  return (
    <section id="diferenciales" className="section">
      <div className="container">
        <div className="section-head reveal">
          <span className="kicker"><span className="dot" /> Diferenciales</span>
          <h2>Mismo precio que los genéricos.<br />Resultados que no se le acercan.</h2>
          <p>Pre-venta inteligente, multi-canal de verdad y copiloto humano. Tres cosas que cambian cómo vende tu negocio — y que la competencia sigue prometiendo sin entregar.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {DIFFS.map((d, i) => (
            <div key={i} className="diff-card reveal" style={{ transitionDelay: `${i * 0.05}s` }}>
              <div>
                <div className="diff-title">{d.title}</div>
                <p className="diff-desc">{d.desc}</p>
              </div>
              <div className="diff-vs">
                {d.bad.map((b, j) => (
                  <div key={`b-${j}`} className="row bad">
                    <span className="mark">×</span> {b}
                  </div>
                ))}
                {d.good.map((g, j) => (
                  <div key={`g-${j}`} className="row good">
                    <span className="mark">✓</span> {g}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────── FAQ ─────────── */

function FAQSection() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section id="faq" className="section">
      <div className="container">
        <div className="section-head reveal">
          <span className="kicker"><span className="dot" /> Preguntas frecuentes</span>
          <h2>Lo que nos preguntan<br />antes de probarlo.</h2>
          <p>Respondemos sin rodeos. Si tu pregunta no está, mandanos un mail a hola@getagentro.com.</p>
        </div>
        <div className="faq reveal">
          {FAQS.map((f, i) => (
            <div
              key={i}
              className={`faq-item ${open === i ? "open" : ""}`}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <div className="faq-q">{f.q}</div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
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
      mockupRef.current.style.transform = `translateY(${y * 0.12}px) perspective(1800px) rotateX(${Math.max(0, 6 - y * 0.015)}deg)`;
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
  const inviteHref = "#precios";

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
            <a href="#features">Producto</a>
            <a href="#como">Cómo funciona</a>
            <a href="#diferenciales">Diferenciales</a>
            <a href="#precios">Beta</a>
            <a href="#faq">FAQ</a>
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
                <a href={inviteHref} className="btn btn-primary">
                  Pedir invitación <Icon name="arrow" size={14} className="arrow" />
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
            <span className="dot" /> Beta cerrada · por invitación
          </span>
          <AnimatedHeadline />
          <p className="hero-sub">
            El agente atiende tus chats como vos lo harías — pregunta, recomienda combos, junta los datos y te pasa el cliente caliente. Vos te despertás, abrís el inbox y solo te queda cobrar.
          </p>
          <div className="hero-cta">
            <a href={inviteHref} className="btn btn-primary btn-lg">
              Pedir invitación <Icon name="arrow" size={14} className="arrow" />
            </a>
            <a href="#demo" className="btn btn-ghost btn-lg">Ver el agente en vivo</a>
          </div>
          <div className="hero-meta">
            <span><Icon name="check" size={12} /> Gratis durante la beta</span>
            <span><Icon name="check" size={12} /> WhatsApp + Tienda web + Caja</span>
            <span><Icon name="check" size={12} /> Español · LATAM</span>
          </div>

          <div className="hero-honest-row">
            <span className="hero-honest-item"><b>24/7</b> sin frenar</span>
            <span className="hero-honest-item"><b>3 canales</b> unificados</span>
            <span className="hero-honest-item"><b>5 etapas</b> de venta</span>
            <span className="hero-honest-item"><b>Copiloto</b> humano</span>
          </div>

          <div ref={mockupRef} className="mockup-wrap" id="demo">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="section problem">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> El problema</span>
            <h2>Estás atendiendo todo solo.<br />Y se te va de las manos.</h2>
            <p>El pequeño negocio que vende por WhatsApp tiene un techo: vos. Cuando crece el volumen, perdés ventas a la noche, mezclás stock entre canales, y no podés contratar a alguien por 4 horas sueltas.</p>
          </div>
          <div className="problem-grid">
            {PROBLEMS.map((p, i) => (
              <div key={i} className="problem-item reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
                <p className="problem-quote">{p.quote}</p>
                <div className="problem-attr">— {p.who}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHANNELS */}
      <section id="features" className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> Plataforma</span>
            <h2>Tres canales, un solo lugar.<br />Y un agente que los maneja por vos.</h2>
            <p>WhatsApp donde están tus clientes, tu tienda online para los que llegan por Google y la caja para los que entran al local. Mismo stock, mismo cliente, misma pantalla.</p>
          </div>
          <ChannelsStrip />
        </div>
      </section>

      {/* FEATURES grid */}
      <section className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> Features</span>
            <h2>Cada pieza, pensada para vender más.</h2>
            <p>Todo lo que arma una venta — chat, tienda, cobro, caja, equipo — conectado entre sí y manejado por el agente. Sin armar el rompecabezas vos.</p>
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
            <h2>Para el negocio que ya factura,<br />pero se le queda chico el día.</h2>
            <p>Si vendés todos los días por WhatsApp y se te van clientes por no llegar a contestar, Agentro fue diseñado exactamente para vos.</p>
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

      <Differentiators />

      {/* PRICING — beta */}
      <section id="precios" className="section">
        <div className="container">
          <div className="section-head reveal">
            <span className="kicker"><span className="dot" /> Precios</span>
            <h2>Gratis durante la beta.<br />Sin letra chica.</h2>
            <p>Mientras estemos en beta cerrada, todo Agentro es gratis para los negocios invitados. Al lanzamiento público anunciamos pricing con tiempo, y los de la beta arrancan con plan preferencial.</p>
          </div>

          <div className="beta-pricing reveal">
            <div className="beta-pricing-left">
              <span className="beta-tag">BETA CERRADA · POR INVITACIÓN</span>
              <div className="beta-price">
                <span className="amount">$0</span>
                <span className="strike">pricing al lanzamiento</span>
              </div>
              <p className="beta-sub">Todas las features, sin límites de pedidos ni canales. La única condición: contanos lo que funciona y lo que no.</p>
              <div className="beta-fine">Sin tarjeta · cancelás cuando quieras · soporte por WhatsApp con el equipo</div>
            </div>
            <div className="beta-pricing-right">
              <div className="beta-includes">Incluye</div>
              <ul className="beta-list">
                <li><Icon name="check" size={14} /> Vendedor de IA 24/7 en WhatsApp</li>
                <li><Icon name="check" size={14} /> Tu tienda online en tu subdominio</li>
                <li><Icon name="check" size={14} /> Caja para tu local físico</li>
                <li><Icon name="check" size={14} /> Equipo con copiloto humano</li>
                <li><Icon name="check" size={14} /> Inbox unificado con kanban</li>
                <li><Icon name="check" size={14} /> Catálogo con variantes y stock</li>
                <li><Icon name="check" size={14} /> Soporte directo con el equipo</li>
              </ul>
              <a href={signupHref} className="beta-cta">
                Pedir invitación <Icon name="arrow" size={14} className="arrow" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <FAQSection />

      {/* CTA FINAL */}
      <section className="cta-final">
        <div className="container">
          <span className="kicker reveal" style={{ marginBottom: 24 }}>
            <span className="dot" /> Empezá hoy
          </span>
          <h2 className="reveal">El agente trabaja siempre.<br />Vos te despertás con plata en el aire.</h2>
          <p className="reveal delay-1">Conectá WhatsApp, cargá tu catálogo y pasá a pensar el negocio, no en contestar mensajes. Gratis durante la beta — sin tarjeta, sin compromiso.</p>
          <a href={signupHref} className="btn btn-primary btn-lg reveal delay-2">
            Pedir invitación a la beta <Icon name="arrow" size={16} className="arrow" />
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="container footer-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="logo-mark" />
            <span>Agentro © {new Date().getFullYear()} · getagentro.com</span>
          </div>
          <div className="footer-links">
            <a href="mailto:hola@getagentro.com">hola@getagentro.com</a>
            <Link href="/terms">Términos</Link>
            <Link href="/privacy">Privacidad</Link>
            <a href="#">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
