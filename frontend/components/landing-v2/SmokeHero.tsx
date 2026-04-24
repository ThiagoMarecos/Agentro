"use client";

import { useEffect, useRef } from "react";

/**
 * Volumetric smoke / nebula WebGL background.
 * x.ai-inspired atmospheric look using FBM + domain warping with an
 * interactive light source that follows the cursor.
 */
export default function SmokeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    const DPR = Math.min(1.5, window.devicePixelRatio || 1);
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * DPR);
      canvas.height = Math.floor(h * DPR);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const vs = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uRes;
      uniform vec2 uMouse;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 6; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
        float t = uTime * 0.08;

        vec2 q = vec2(fbm(uv + vec2(0.0, 0.0) + t),
                      fbm(uv + vec2(5.2, 1.3) - t));
        vec2 r = vec2(fbm(uv + 2.0 * q + vec2(1.7, 9.2) + t * 0.7),
                      fbm(uv + 2.0 * q + vec2(8.3, 2.8) + t * 0.6));
        float n = fbm(uv + 2.5 * r + t * 0.4);

        vec2 light = (uMouse - 0.5 * uRes) / uRes.y;
        light = mix(vec2(0.0, 0.0), light, step(0.001, length(uMouse)) * 0.6);

        float dLight = length(uv - light);
        float glow = exp(-dLight * 1.4);

        float density = smoothstep(0.1, 0.95, n) * (0.22 + glow * 0.7);

        vec3 navy = vec3(0.015, 0.018, 0.055);
        vec3 purple = vec3(0.22, 0.17, 0.42);
        vec3 highlight = vec3(0.55, 0.48, 0.78);

        vec3 col = navy;
        col = mix(col, purple, density * 0.85);
        col = mix(col, highlight, pow(density, 3.0) * glow * 0.55);

        float vig = 1.0 - smoothstep(0.3, 1.1, length(uv));
        col *= vig * 0.85 + 0.18;

        col += (hash(gl_FragCoord.xy + t) - 0.5) * 0.012;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };

    const vsh = compile(gl.VERTEX_SHADER, vs);
    const fsh = compile(gl.FRAGMENT_SHADER, fs);
    if (!vsh || !fsh) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "uTime");
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uMouse = gl.getUniformLocation(prog, "uMouse");

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) * DPR;
      mouse.ty = (r.height - (e.clientY - r.top)) * DPR;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const time = (t - t0) * 0.001;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform1f(uTime, time);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="smoke-canvas" />;
}
