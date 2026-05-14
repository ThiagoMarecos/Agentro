"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  acceptInvitation,
  getInvitationInfo,
  type InvitationInfo,
} from "@/lib/api/team";
import styles from "./invite.module.css";

const ROLE_LABELS: Record<string, string> = {
  manager: "Gerente",
  seller:  "Vendedor/a",
  support: "Soporte",
};

// ---- WebGL smoke (same shader as login page) ----
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
      canvas.width  = Math.floor(innerWidth  * DPR);
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

// ---- Password strength ----
function StrengthBars({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8)         score++;
  if (/[A-Z]/.test(password))       score++;
  if (/[0-9]/.test(password))       score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const cls  = ["", "s1", "s2", "s3", "s4"];
  const labels = ["", "Muy débil", "Débil", "Buena", "Excelente"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

  if (!password) return null;
  return (
    <>
      <div className={styles.strengthWrap}>
        {[1,2,3,4].map(i => (
          <div key={i} className={`${styles.strengthBar}${i <= score ? ` ${styles[cls[score] as keyof typeof styles]}` : ""}`} />
        ))}
      </div>
      <div className={styles.strengthLabel} style={{ color: colors[score] }}>{labels[score]}</div>
    </>
  );
}

// ---- Google icon ----
function GoogleIcon() {
  return (
    <svg className={styles.gIcon} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ---- Main page ----
export default function TeamInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { user, login } = useAuth();
  const token = params.token;

  const [info, setInfo]           = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading]     = useState(true);

  const [fullName, setFullName]   = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsError, setTermsError]     = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake]         = useState(false);
  const [success, setSuccess]     = useState(false);

  useEffect(() => {
    getInvitationInfo(token)
      .then(setInfo)
      .catch((e) => setLoadError(e.message || "Invitación no válida"))
      .finally(() => setLoading(false));
  }, [token]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const isLoggedInAsRightUser = !!(user && info && user.email === info.email);
  const needsPasswordOnly     = !!(info?.user_exists && !isLoggedInAsRightUser);
  const isCreatingAccount     = !!(info && !info.user_exists);

  const onAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setError("");
    setConfirmError(false);
    setTermsError(false);

    // Terms required for new accounts
    if (isCreatingAccount && !termsChecked) {
      setTermsError(true);
      triggerShake();
      return;
    }

    // Password confirmation check for new accounts
    if (isCreatingAccount && password !== confirm) {
      setConfirmError(true);
      triggerShake();
      return;
    }

    setSubmitting(true);
    try {
      if (isLoggedInAsRightUser) {
        const r = await acceptInvitation(token, {});
        setSuccess(true);
        setTimeout(() => router.push(`/app?store=${r.store_id}&welcome=team`), 2000);
        return;
      }

      if (needsPasswordOnly) {
        if (!password || password.length < 6) {
          setError("Esta cuenta ya existe. Ingresá tu contraseña para asociarla a la tienda.");
          setSubmitting(false);
          return;
        }
        await login(info.email, password);
        const r = await acceptInvitation(token, {});
        setSuccess(true);
        setTimeout(() => router.push(`/app?store=${r.store_id}&welcome=team`), 2000);
        return;
      }

      // New account
      if (!password || password.length < 6) {
        setError("Elegí una contraseña de al menos 6 caracteres.");
        setSubmitting(false);
        return;
      }
      await acceptInvitation(token, { full_name: fullName.trim() || undefined, password });
      await login(info.email, password);
      setSuccess(true);
      setTimeout(() => router.push(`/app?welcome=team`), 2000);
    } catch (e: any) {
      setError(e.message || "No pudimos aceptar la invitación");
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = info ? (ROLE_LABELS[info.role] || info.role) : "";
  const inviterInitials = info?.inviter_name
    ? info.inviter_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const expiryFormatted = info?.expires_at
    ? new Date(info.expires_at).toLocaleDateString("es-AR")
    : null;

  // Shared background layers
  const BgLayers = () => (
    <>
      <SmokeCanvas />
      <div className={styles.gridOverlay} />
      <Link href="/" className={styles.backLink}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Inicio
      </Link>
    </>
  );

  if (loading) {
    return (
      <div className={styles.root}>
        <BgLayers />
        <div className={styles.loadingScreen}>Cargando invitación…</div>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className={styles.root}>
        <BgLayers />
        <div className={styles.errorScreen}>
          <div className={styles.errorCard}>
            <h1>Invitación no válida</h1>
            <p>{loadError || "No pudimos encontrar esta invitación."}</p>
            <Link href="/login" className={styles.btnGoLogin}>Ir a login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <BgLayers />

      <div className={styles.page}>
        {/* Top logo */}
        <Link href="/" className={styles.topLogo} aria-label="Agentro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agentro-white.png" alt="Agentro" className={styles.topLogoImg} />
        </Link>

        {/* Context banner */}
        <div className={styles.inviteBanner}>
          <div className={styles.bannerText}>
            <strong>{info.store_name}</strong> te invitó a unirte a Agentro como{" "}
            <span className={styles.bannerRole}>{roleLabel}</span>
          </div>
        </div>

        {/* Card */}
        <div className={`${styles.card}${shake ? ` ${styles.shake}` : ""}`}>

          {/* Success overlay */}
          {success && (
            <div className={styles.successOverlay}>
              <div className={styles.successIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className={styles.successTitle}>¡Bienvenido al equipo!</div>
              <div className={styles.successSub}>Tu cuenta fue activada. Redirigiendo a tu dashboard…</div>
            </div>
          )}

          {/* Inviter header */}
          <div className={styles.inviterHeader}>
            <div className={styles.inviterPhoto}>
              {info.inviter_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.inviter_avatar_url}
                  alt={info.inviter_name || "Inviter"}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                inviterInitials
              )}
            </div>
            <div className={styles.inviterInfo}>
              <div className={styles.inviterLabel}>Invitación de</div>
              <div className={styles.inviterName}>{info.inviter_name || info.store_name}</div>
              <div className={styles.inviterSub}>{roleLabel} · {info.store_name}</div>
            </div>
            <div className={styles.verifiedBadge}>Verificado</div>
          </div>

          {/* Invite message */}
          <div className={styles.inviteMsg}>
            Vas a unirte a <strong>{info.store_name}</strong> en Agentro con el rol de{" "}
            <span className={styles.rolePill}>{roleLabel}</span>.{" "}
            {isLoggedInAsRightUser
              ? "Ya estás autenticado. Hacé click para aceptar."
              : "Completá tu cuenta para empezar."}
          </div>

          <form onSubmit={onAccept}>
            {/* Logged-in as right user */}
            {isLoggedInAsRightUser && (
              <div className={styles.alreadyLoggedIn}>
                ✓ Estás logueado como <strong>{user!.email}</strong>. Aceptá para unirte.
              </div>
            )}

            {/* Email (always readonly) */}
            {!isLoggedInAsRightUser && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Email de la invitación
                  <span className={styles.fieldNote}>No editable</span>
                </label>
                <input readOnly value={info.email} className={styles.fieldInput} />
              </div>
            )}

            {/* Full name (new accounts only) */}
            {isCreatingAccount && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Tu nombre (opcional)</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Pérez"
                  className={styles.fieldInput}
                />
              </div>
            )}

            {/* Password */}
            {!isLoggedInAsRightUser && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {needsPasswordOnly ? "Contraseña de tu cuenta" : "Elegí una contraseña"}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={needsPasswordOnly ? "••••••••" : "Mínimo 8 caracteres"}
                  autoComplete={isCreatingAccount ? "new-password" : "current-password"}
                  className={styles.fieldInput}
                />
                {isCreatingAccount && <StrengthBars password={password} />}
              </div>
            )}

            {/* Confirm password (new accounts only) */}
            {isCreatingAccount && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Confirmá tu contraseña</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setConfirmError(false); }}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  className={`${styles.fieldInput}${confirmError ? ` ${styles.inputError}` : ""}`}
                />
              </div>
            )}

            {error && <div className={styles.errorBox}>{error}</div>}

            {/* Bottom group: terms + buttons */}
            <div className={styles.bottomGroup}>
              {/* Terms checkbox (new accounts only) */}
              {isCreatingAccount && (
                <div
                  className={`${styles.checkRow}${termsError ? ` ${styles.termsError}` : ""}`}
                  onClick={() => { setTermsChecked(!termsChecked); setTermsError(false); }}
                >
                  <div className={`${styles.checkBox}${termsChecked ? ` ${styles.checked}` : ""}`}>
                    {termsChecked && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1.5 6 5 9.5 10.5 2.5" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.checkText}>
                    Acepto los{" "}
                    <a href="#" onClick={(e) => e.stopPropagation()}>Términos de servicio</a>
                    {" "}y la{" "}
                    <a href="#" onClick={(e) => e.stopPropagation()}>Política de privacidad</a>
                    {" "}de Agentro.
                  </div>
                </div>
              )}

              <button type="submit" disabled={submitting} className={styles.btnPrimary}>
                {submitting ? <span className={styles.spinner} /> : null}
                {submitting ? "Procesando…" : "Aceptar invitación"}
              </button>

              {isCreatingAccount && (
                <>
                  <div className={styles.divider}>
                    <span className={styles.dividerText}>o continuá con</span>
                  </div>
                  <button type="button" className={styles.btnGoogle}>
                    <GoogleIcon />
                    Continuar con Google
                  </button>
                </>
              )}
            </div>
          </form>

          {/* Expiry */}
          <div className={styles.expiry}>
            {expiryFormatted && <span>Vence el {expiryFormatted}</span>}
            {expiryFormatted && <span className={styles.expiryDot} />}
            <span>
              ¿No esperabas esto?{" "}
              <Link href="/" className={styles.expiryIgnore}>Ignorarla</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
