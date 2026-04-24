"use client";

import { useEffect, useRef } from "react";

interface Props {
  size?: number;
  color?: string;
}

/**
 * Wireframe rotating sphere rendered on a 2D canvas.
 * Used inside the "multi-canal unificado" feature card.
 */
export default function MiniGlobe({ size = 120, color = "#6d4cff" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * DPR;
    canvas.height = size * DPR;
    ctx.scale(DPR, DPR);

    const N = 180;
    const points: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      points.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
      });
    }

    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const time = (t - t0) * 0.0006;
      ctx.clearRect(0, 0, size, size);
      const r = size * 0.38;
      const cx = size / 2;
      const cy = size / 2;
      const ca = Math.cos(time);
      const sa = Math.sin(time);
      const proj = points.map((p) => {
        const x = p.x * ca - p.z * sa;
        const z = p.x * sa + p.z * ca;
        const y = p.y;
        return { x, y, z };
      });

      ctx.strokeStyle = color + "40";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      proj.forEach((p) => {
        const depth = (p.z + 1) / 2;
        const alpha = Math.floor(depth * 220 + 20).toString(16).padStart(2, "0");
        ctx.fillStyle = color + alpha;
        ctx.beginPath();
        ctx.arc(cx + p.x * r, cy + p.y * r, 0.6 + depth * 1.4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.strokeStyle = color + "30";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < proj.length; i++) {
        if (proj[i].z < 0) continue;
        for (let j = i + 1; j < proj.length; j++) {
          if (proj[j].z < 0) continue;
          const dx = proj[i].x - proj[j].x;
          const dy = proj[i].y - proj[j].y;
          const dz = proj[i].z - proj[j].z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < 0.35) {
            ctx.beginPath();
            ctx.moveTo(cx + proj[i].x * r, cy + proj[i].y * r);
            ctx.lineTo(cx + proj[j].x * r, cy + proj[j].y * r);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [size, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
