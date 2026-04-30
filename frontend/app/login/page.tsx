"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { getOnboardingStatus } from "@/lib/api/onboarding";
import { getGoogleAuthUrl } from "@/lib/auth";
import styles from "./login.module.css";

// ---- WebGL smoke background ----
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

    const vs = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;
    const fs = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uRes;
      uniform vec2 uMouse;

      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      float fbm(vec2 p) {
        float v=0.0,a=0.5;
        for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
        return v;
      }
      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
        float t = uTime*0.07;
        vec2 q = vec2(fbm(uv+t), fbm(uv+vec2(5.2,1.3)-t));
        vec2 r = vec2(fbm(uv+2.0*q+vec2(1.7,9.2)+t*0.7), fbm(uv+2.0*q+vec2(8.3,2.8)+t*0.6));
        float n = fbm(uv+2.5*r+t*0.4);

        vec2 light = (uMouse - 0.5*uRes)/uRes.y;
        light = mix(vec2(0.0,0.0), light, step(0.001, length(uMouse))*0.7);
        float dL = length(uv - light);
        float glow = exp(-dL*1.6);

        float density = smoothstep(0.08,0.92,n)*(0.28+glow*0.9);

        vec3 base   = vec3(0.012,0.014,0.048);
        vec3 purple = vec3(0.26,0.20,0.52);
        vec3 hi     = vec3(0.58,0.50,0.82);
        vec3 col = base;
        col = mix(col, purple, density*0.9);
        col = mix(col, hi, pow(density,2.8)*glow*0.7);

        float vig = 1.0-smoothstep(0.35,1.2,length(uv));
        col *= vig*0.88+0.14;
        col += (hash(gl_FragCoord.xy+t)-0.5)*0.01;
        gl_FragColor = vec4(col,1.0);
      }
    `;

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime  = gl.getUniformLocation(prog, "uTime");
    const uRes   = gl.getUniformLocation(prog, "uRes");
    const uMouse = gl.getUniformLocation(prog, "uMouse");

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.tx = e.clientX * DPR;
      mouse.ty = (innerHeight - e.clientY) * DPR;
    };
    window.addEventListener("mousemove", onMouseMove);

    const t0 = performance.now();
    let raf: number;
    function tick(t: number) {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      gl!.uniform1f(uTime, (t - t0) * 0.001);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform2f(uMouse, mouse.x, mouse.y);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.smokeCanvas} />;
}

// ---- Google G icon (colored) ----
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

// ---- Login form ----
function LoginForm() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);
  const [passError, setPassError] = useState(false);

  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/app";
  const oauthError    = searchParams.get("error");

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPassError(false);
    setLoading(true);
    try {
      await login(email, password);
      const status = await getOnboardingStatus();
      if (status.suggested_redirect === "/admin") {
        router.push("/admin");
      } else if (status.has_store) {
        router.push(redirectParam);
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
      setPassError(true);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const oauthErrorMsg =
    oauthError === "oauth_failed"        ? "Error al iniciar sesión con Google" :
    oauthError === "oauth_token_failed"  ? "Error al intercambiar el código de Google. Verificá el redirect URI en Google Cloud Console." :
    oauthError === "google_not_configured" ? "Google no está configurado. Usá tu email y contraseña para entrar." :
    "";

  const isAmberError = oauthError === "google_not_configured";

  return (
    <div className={styles.loginRoot}>
      <SmokeCanvas />
      <div className={styles.gridOverlay} />

      <Link href="/" className={styles.backLink}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver a inicio
      </Link>

      <div className={styles.page}>
        <div className={`${styles.card}${shake ? ` ${styles.shake}` : ""}`}>

          <Link href="/" className={styles.logo}>
            <div className={styles.logoMark} />
            <span className={styles.logoText}>Agentro</span>
          </Link>

          <h1 className={styles.heading}>Iniciar sesión</h1>
          <p className={styles.sub}>Accedé a tu panel de Agentro</p>

          {(error || oauthErrorMsg) && (
            <div className={`${styles.errorBox} ${isAmberError ? styles.errorAmber : styles.errorRed}`}>
              {error || oauthErrorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.fieldInput}
                placeholder="tu@email.com"
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPassError(false); }}
                className={`${styles.fieldInput}${passError ? ` ${styles.inputError}` : ""}`}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <div className={styles.forgotRow}>
              <a href="#" className={styles.forgotLink}>¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" disabled={loading} className={styles.btnPrimary}>
              {loading ? <span className={styles.spinner} /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className={styles.divider}>
            <span className={styles.dividerText}>o continuá con</span>
          </div>

          <a
            href={getGoogleAuthUrl("login")}
            className={styles.btnGoogle}
          >
            <GoogleIcon />
            Iniciar sesión con Google
          </a>

          <p className={styles.cardFooter}>
            ¿No tenés cuenta?{" "}
            <Link href="/signup">Registrate gratis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#05060f", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ba0c0", fontFamily: "sans-serif" }}>
        Cargando...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
