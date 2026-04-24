"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

type ChatMsg =
  | { role: "user"; text: string }
  | { role: "bot"; text: string }
  | { role: "typing" };

const SCRIPT: ChatMsg[] = [
  { role: "user", text: "Hola, tienen remeras negras talle M?" },
  { role: "typing" },
  { role: "bot", text: "Sí! Tenemos 12 unidades. Son $18.900 con envío gratis a CABA. ¿Te la reservo?" },
  { role: "user", text: "Dale, paso por ella mañana" },
  { role: "typing" },
  { role: "bot", text: "Listo ✓ Orden #A-2847 creada. Te esperamos mañana de 10 a 20hs." },
];

const BARS = [30, 45, 38, 60, 52, 72, 85, 68, 90, 78, 95, 88];

export default function HeroMockup() {
  const [orderCount, setOrderCount] = useState(124);
  const [revenue, setRevenue] = useState(8420);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [step, setStep] = useState(0);

  // Live updates for stats
  useEffect(() => {
    const id = setInterval(() => {
      setOrderCount((n) => n + (Math.random() > 0.6 ? 1 : 0));
      setRevenue((r) => r + Math.floor(Math.random() * 80));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Chat script loop
  useEffect(() => {
    if (step >= SCRIPT.length) {
      const t = setTimeout(() => {
        setMessages([]);
        setStep(0);
      }, 3500);
      return () => clearTimeout(t);
    }
    const cur = SCRIPT[step];
    const delay = cur.role === "typing" ? 900 : cur.role === "user" ? 1400 : 1800;
    const t = setTimeout(() => {
      setMessages((m) => {
        const filtered = m.filter((x) => x.role !== "typing");
        return [...filtered, cur];
      });
      setStep((s) => s + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="mockup">
      <div className="mockup-bar">
        <div className="mockup-dot" />
        <div className="mockup-dot" />
        <div className="mockup-dot" />
        <div className="mockup-url">agentro.app / dashboard</div>
        <div style={{ width: 30 }} />
      </div>
      <div className="mockup-body">
        {/* Sidebar */}
        <div className="mockup-sidebar">
          <div className="logo" style={{ padding: "4px 10px 12px", fontSize: 14 }}>
            <div className="logo-mark" />
            <span>Agentro</span>
          </div>
          <div className="side-group">General</div>
          <div className="side-item active"><Icon name="home" size={14} className="ico" />Dashboard</div>
          <div className="side-item"><Icon name="inbox" size={14} className="ico" />Pedidos<span className="count">47</span></div>
          <div className="side-item"><Icon name="chat" size={14} className="ico" />Conversaciones<span className="count">12</span></div>
          <div className="side-item"><Icon name="box" size={14} className="ico" />Productos</div>
          <div className="side-item"><Icon name="users" size={14} className="ico" />Clientes</div>
          <div className="side-group">Agente IA</div>
          <div className="side-item"><Icon name="sparkle" size={14} className="ico" />Entrenamiento</div>
          <div className="side-item"><Icon name="chart" size={14} className="ico" />Rendimiento</div>
          <div className="side-item"><Icon name="settings" size={14} className="ico" />Ajustes</div>
        </div>

        {/* Main */}
        <div className="mockup-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hoy</div>
              <div style={{ fontSize: 18, fontWeight: 500, marginTop: 2 }}>Resumen de ventas</div>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)", display: "inline-block", animation: "lp-pulse 2s infinite" }} /> EN VIVO
            </div>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-label">Pedidos</div>
              <div className="stat-value">{orderCount}</div>
              <div className="stat-delta">↑ +12.4%</div>
            </div>
            <div className="stat">
              <div className="stat-label">Ingresos</div>
              <div className="stat-value">${revenue.toLocaleString("es-AR")}</div>
              <div className="stat-delta">↑ +28.1%</div>
            </div>
            <div className="stat">
              <div className="stat-label">Conversión</div>
              <div className="stat-value">42%</div>
              <div className="stat-delta">↑ +6.3%</div>
            </div>
          </div>

          <div className="chart">
            <div className="chart-head">
              <div className="chart-title">Ventas por hora</div>
              <div className="chart-legend">Últimas 12h</div>
            </div>
            <div className="bars">
              {BARS.map((h, i) => (
                <div key={i} className="bar" style={{ height: `${h}%`, animation: `lp-rise .6s ${i * 0.05}s cubic-bezier(.2,.8,.2,1) both` }} />
              ))}
            </div>
          </div>

          <div className="orders">
            {[
              { id: "A-2847", name: "Martín G.", amount: "$18.900", status: "Nuevo" },
              { id: "A-2846", name: "Sofía R.", amount: "$32.400", status: "Pagado" },
              { id: "A-2845", name: "Lucas P.", amount: "$9.600", status: "Enviado" },
            ].map((o) => (
              <div key={o.id} className="order">
                <span className="order-id">{o.id}</span>
                <span>{o.name}</span>
                <span style={{ color: "var(--fg-2)", marginLeft: "auto", marginRight: 12 }}>{o.amount}</span>
                <span className="order-status">{o.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div className="mockup-panel">
          <div className="chat">
            <div className="chat-head">
              <div className="avatar">A</div>
              <div>
                <div style={{ fontWeight: 500 }}>Agente Agentro</div>
                <div style={{ fontSize: 11, color: "var(--fg-3)" }}>Atendiendo 12 chats</div>
              </div>
              <div className="status">Online</div>
            </div>
            <div className="chat-body">
              {messages.map((m, i) => {
                if (m.role === "typing") {
                  return (
                    <div key={i} className="bubble bot typing">
                      <span /><span /><span />
                    </div>
                  );
                }
                return <div key={i} className={`bubble ${m.role}`}>{m.text}</div>;
              })}
            </div>
            <div className="chat-input">
              <div className="dot" /> IA respondiendo automáticamente
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
