"use client";

/**
 * Layout del onboarding — smoke + grid + glass aesthetic.
 * Mismo background animado que /login, /signup y /request-invite.
 */

import { useEffect, useRef } from "react";
import styles from "./onboarding.module.css";

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
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, comp(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, comp(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uT = gl.getUniformLocation(prog, "uTime");
    const uR = gl.getUniformLocation(prog, "uRes");
    const uM = gl.getUniformLocation(prog, "uMouse");
    const m = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: MouseEvent) => {
      m.tx = e.clientX * DPR;
      m.ty = (innerHeight - e.clientY) * DPR;
    };
    window.addEventListener("mousemove", onMove);

    const t0 = performance.now();
    let raf: number;
    function tick(t: number) {
      m.x += (m.tx - m.x) * 0.06;
      m.y += (m.ty - m.y) * 0.06;
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

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.root}>
      <SmokeCanvas />
      <div className={styles.gridOverlay} />
      <div className={styles.page}>
        <div className={styles.container}>{children}</div>
      </div>
    </div>
  );
}
