"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  createInvitationRequest,
  type BusinessType,
  type ReferralSource,
} from "@/lib/api/invitations-public";
import styles from "./request-invite.module.css";

/* ── Dropdown custom (glass + accent, sin el <select> feo del browser) ── */
function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.v === value);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      setHighlight(Math.max(0, options.findIndex((o) => o.v === value)));
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0) {
        onChange(options[highlight].v);
        setOpen(false);
      }
    }
  };

  return (
    <div className={styles.selectWrap} ref={wrapRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onKeyDown={onTriggerKey}
        className={`${styles.selectBtn}${open ? ` ${styles.selectBtnOpen}` : ""}${
          selected ? "" : ` ${styles.selectBtnEmpty}`
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.selectValue}>
          {selected ? selected.label : placeholder || "Elegí una opción..."}
        </span>
        <svg
          className={`${styles.selectChevron}${open ? ` ${styles.selectChevronOpen}` : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.selectMenu} role="listbox" tabIndex={-1} onKeyDown={onListKey}>
          {options.map((o, i) => {
            const isActive = o.v === value;
            const isHl = i === highlight;
            return (
              <button
                key={o.v}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setHighlight(i)}
                className={`${styles.selectOption}${isActive ? ` ${styles.selectOptionActive}` : ""}${
                  isHl ? ` ${styles.selectOptionHl}` : ""
                }`}
                onClick={() => {
                  onChange(o.v);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {isActive && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── WebGL smoke (mismo shader que login / team-invite) ── */
function SmokeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const DPR = Math.min(1.5, devicePixelRatio || 1);
    function resize() {
      if (!canvas || !gl) return;
      canvas.width = Math.floor(innerWidth * DPR);
      canvas.height = Math.floor(innerHeight * DPR);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    const vs = `attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}`;
    const fs = `precision highp float;
      uniform float uTime;uniform vec2 uRes,uMouse;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}
      void main(){
        vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;float t=uTime*0.07;
        vec2 q=vec2(fbm(uv+t),fbm(uv+vec2(5.2,1.3)-t));
        vec2 r=vec2(fbm(uv+2.0*q+vec2(1.7,9.2)+t*0.7),fbm(uv+2.0*q+vec2(8.3,2.8)+t*0.6));
        float n=fbm(uv+2.5*r+t*0.4);
        vec2 light=(uMouse-0.5*uRes)/uRes.y;
        light=mix(vec2(0.0),light,step(0.001,length(uMouse))*0.7);
        float glow=exp(-length(uv-light)*1.7);
        float density=smoothstep(0.08,0.92,n)*(0.25+glow*0.85);
        vec3 base=vec3(0.012,0.014,0.048),purple=vec3(0.26,0.20,0.52),hi=vec3(0.55,0.48,0.80);
        vec3 col=mix(mix(base,purple,density*0.9),hi,pow(density,2.8)*glow*0.65);
        float vig=1.0-smoothstep(0.35,1.2,length(uv));col*=vig*0.88+0.14;
        col+=(hash(gl_FragCoord.xy+t)-0.5)*0.01;
        gl_FragColor=vec4(col,1.0);}`;

    function comp(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src); gl!.compileShader(s); return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, comp(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, comp(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uT = gl.getUniformLocation(prog, "uTime");
    const uR = gl.getUniformLocation(prog, "uRes");
    const uM = gl.getUniformLocation(prog, "uMouse");
    const m = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: MouseEvent) => { m.tx = e.clientX * DPR; m.ty = (innerHeight - e.clientY) * DPR; };
    window.addEventListener("mousemove", onMove);

    const t0 = performance.now();
    let raf: number;
    function tick(t: number) {
      m.x += (m.tx - m.x) * 0.06; m.y += (m.ty - m.y) * 0.06;
      gl!.uniform1f(uT, (t - t0) * 0.001);
      gl!.uniform2f(uR, canvas!.width, canvas!.height);
      gl!.uniform2f(uM, m.x, m.y);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.smokeCanvas} />;
}

const BUSINESS_TYPES: { v: BusinessType; label: string }[] = [
  { v: "retail", label: "Retail / Moda" },
  { v: "gastro", label: "Gastronomía" },
  { v: "services", label: "Servicios" },
  { v: "ecommerce", label: "E-commerce" },
  { v: "other", label: "Otro" },
];

const REFERRAL_SOURCES: { v: ReferralSource; label: string }[] = [
  { v: "google", label: "Google" },
  { v: "ai", label: "Sugerencia de IA (ChatGPT / Claude / Perplexity / etc)" },
  { v: "recommendation", label: "Me lo recomendaron" },
  { v: "social", label: "Redes sociales (Instagram / X / TikTok / LinkedIn)" },
  { v: "ad", label: "Publicidad" },
  { v: "press", label: "Una nota o artículo" },
  { v: "event", label: "Un evento / charla" },
  { v: "other", label: "Otro" },
];

export default function RequestInvitePage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("retail");
  const [businessTypeOther, setBusinessTypeOther] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [country, setCountry] = useState("");
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");
  const [referralDetail, setReferralDetail] = useState("");
  const [expectations, setExpectations] = useState("");
  const [acceptsContact, setAcceptsContact] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState<{ message: string } | null>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Necesitamos un email válido.");
      triggerShake();
      return;
    }
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("¿Cómo te llamás?");
      triggerShake();
      return;
    }
    if (!businessName.trim()) {
      setError("¿Cuál es el nombre de tu negocio?");
      triggerShake();
      return;
    }
    if (!acceptsContact) {
      setError("Necesitamos tu OK para contactarte por mail.");
      triggerShake();
      return;
    }

    setSubmitting(true);
    try {
      // Si eligió "Otro" como rubro y nos contó cuál, lo metemos en expectations
      // para que no se pierda (el backend solo acepta el enum).
      const otherRubroNote =
        businessType === "other" && businessTypeOther.trim()
          ? `[Rubro: ${businessTypeOther.trim()}]`
          : "";
      const finalExpectations = [otherRubroNote, expectations.trim()]
        .filter(Boolean)
        .join("\n\n");

      const res = await createInvitationRequest({
        email: email.trim(),
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        business_type: businessType,
        whatsapp: whatsapp.trim() || undefined,
        country: country.trim() || undefined,
        referral_source: referralSource || undefined,
        referral_detail: referralDetail.trim() || undefined,
        expectations: finalExpectations || undefined,
        accepts_contact: acceptsContact,
      });
      setSuccess({ message: res.message });
    } catch (err: any) {
      setError(err?.message || "No pudimos enviar tu pedido. Intentá de nuevo en un rato.");
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <SmokeCanvas />
      <div className={styles.gridOverlay} />

      <Link href="/" className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver al inicio
      </Link>

      <div className={styles.page}>
        <Link href="/" className={styles.topLogo} aria-label="Agentro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agentro-white.png" alt="Agentro" />
        </Link>

        <div className={styles.kickerBanner}>Beta cerrada · por invitación</div>

        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Pedí tu lugar en la <span className={styles.hl}>beta</span>.
          </h1>
          <p className={styles.heroSub}>
            Contanos un poco de tu negocio y te respondemos por mail en 24hs con el acceso o con un par de preguntas más.
          </p>
        </div>

        <div className={`${styles.card}${shake ? ` ${styles.shake}` : ""}`}>
          {success ? (
            <div className={styles.successWrap}>
              <div className={styles.successIcon}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className={styles.successTitle}>Listo, recibimos tu pedido</h2>
              <p className={styles.successSub}>{success.message}</p>
              <Link href="/" className={styles.successCta}>
                Volver al inicio
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} autoComplete="off">
              <div className={styles.field2col}>
                <div className={styles.field}>
                  <label className={styles.label}>Tu nombre</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Juan Pérez"
                    required
                    maxLength={120}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="juan@minegocio.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className={styles.field2col}>
                <div className={styles.field}>
                  <label className={styles.label}>Nombre del negocio</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Mi Tienda"
                    required
                    maxLength={120}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Rubro</label>
                  <CustomSelect<BusinessType>
                    value={businessType}
                    onChange={(v) => setBusinessType(v)}
                    options={BUSINESS_TYPES}
                    ariaLabel="Rubro del negocio"
                  />
                </div>
              </div>

              {businessType === "other" && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    ¿Cuál es tu rubro? <span className={styles.labelOpt}>contanos en una línea</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={businessTypeOther}
                    onChange={(e) => setBusinessTypeOther(e.target.value)}
                    placeholder="Inmobiliaria, escuela, agencia de viajes, salud..."
                    maxLength={120}
                  />
                </div>
              )}

              <div className={styles.field2col}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    WhatsApp <span className={styles.labelOpt}>opcional</span>
                  </label>
                  <input
                    type="tel"
                    className={styles.input}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+595 981 234 567"
                    maxLength={40}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    País <span className={styles.labelOpt}>opcional</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Argentina / Paraguay / México..."
                    maxLength={40}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  ¿Cómo nos encontraste? <span className={styles.labelOpt}>opcional pero nos sirve un montón</span>
                </label>
                <CustomSelect<ReferralSource>
                  value={referralSource}
                  onChange={(v) => setReferralSource(v)}
                  options={REFERRAL_SOURCES}
                  placeholder="Elegí una opción..."
                  ariaLabel="Cómo nos encontraste"
                />
              </div>

              {referralSource && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    {referralSource === "other"
                      ? "Contanos cómo"
                      : "Detalle"}{" "}
                    <span className={styles.labelOpt}>
                      {referralSource === "other"
                        ? "ayudanos a entender de dónde venís"
                        : "opcional · qué buscabas, qué dijo la IA, quién te recomendó, etc."}
                    </span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={referralDetail}
                    onChange={(e) => setReferralDetail(e.target.value)}
                    placeholder={
                      referralSource === "other"
                        ? "Contanos en una línea..."
                        : "ChatGPT me sugirió Agentro cuando le pedí... / Me lo recomendó..."
                    }
                    maxLength={400}
                  />
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>
                  ¿Qué esperás de Agentro? <span className={styles.labelOpt}>opcional</span>
                </label>
                <textarea
                  className={styles.textarea}
                  value={expectations}
                  onChange={(e) => setExpectations(e.target.value)}
                  placeholder="Contanos qué te pasa hoy con WhatsApp, qué te frustra, qué te imaginás resolver con Agentro..."
                  maxLength={2000}
                  rows={3}
                />
              </div>

              <div
                className={styles.checkRow}
                onClick={() => setAcceptsContact((v) => !v)}
              >
                <div className={`${styles.checkBox}${acceptsContact ? ` ${styles.checked}` : ""}`}>
                  {acceptsContact && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1.5 6 5 9.5 10.5 2.5" />
                    </svg>
                  )}
                </div>
                <div className={styles.checkText}>
                  OK, podés contactarme por mail para responder mi pedido y mandarme novedades de la beta.
                </div>
              </div>

              {error && <div className={styles.errorBox}>{error}</div>}

              <button type="submit" disabled={submitting} className={styles.btnPrimary}>
                {submitting ? <span className={styles.spinner} /> : null}
                {submitting ? "Enviando..." : "Pedir invitación"}
              </button>

              <div className={styles.fineNote}>
                <span>Respuesta en 24hs</span>
                <span className={styles.dot} />
                <span>Sin tarjeta</span>
                <span className={styles.dot} />
                <span>Sin compromiso</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
