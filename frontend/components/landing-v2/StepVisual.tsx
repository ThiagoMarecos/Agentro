"use client";

interface Props {
  step: number;
}

/**
 * Visual on the right side of the "Cómo funciona" section.
 * Switches between four mocks based on the active step in the scroll list.
 */
export default function StepVisual({ step }: Props) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "grid", placeItems: "center" }}>
      {step === 0 && (
        <div style={{ width: "100%", padding: 20 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-3)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Catálogo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {["Remera Negra", "Campera Oversize", "Jean Mom", "Zapatillas", "Buzo Hoodie", "Gorra"].map((name, i) => (
              <div key={i} style={{
                border: "1px solid var(--border)", borderRadius: 10, padding: 12,
                background: "var(--bg-3)",
                animation: `lp-rise .5s ${i * 0.1}s cubic-bezier(.2,.8,.2,1) both`,
              }}>
                <div style={{
                  aspectRatio: "1", borderRadius: 6,
                  background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 6px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.06) 12px)",
                  marginBottom: 8,
                  display: "grid", placeItems: "center",
                  color: "var(--fg-3)", fontFamily: "var(--mono)", fontSize: 10,
                }}>IMG</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{name}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", marginTop: 2 }}>$12.500</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ width: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Entrenando agente</div>
          {[
            { label: "Tono de voz", value: "Cercano y profesional" },
            { label: "Política de envíos", value: "24-48hs CABA" },
            { label: "Métodos de pago", value: "MP, Transferencia, Efectivo" },
            { label: "Horario", value: "Lun-Sáb 9 a 20hs" },
          ].map((item, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8,
              background: "var(--bg-3)",
              animation: `lp-rise .5s ${i * 0.1}s cubic-bezier(.2,.8,.2,1) both`,
            }}>
              <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{item.label}</span>
              <span style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--mono)" }}>✓ {item.value}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: "var(--accent-dim)", border: "1px solid var(--accent)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)" }}>
            AGENTE LISTO · 100%
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ width: "100%", padding: 20 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-3)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>Canales conectados</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[
              { n: "WhatsApp", s: "+54 11 5678-9012" },
              { n: "Instagram", s: "@tutienda" },
              { n: "Tienda web", s: "tutienda.agentro.app" },
              { n: "Mercado Libre", s: "12 publicaciones" },
            ].map((c, i) => (
              <div key={i} style={{
                padding: 14, border: "1px solid var(--border)", borderRadius: 10,
                background: "var(--bg-3)",
                animation: `lp-rise .5s ${i * 0.1}s cubic-bezier(.2,.8,.2,1) both`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.n}</span>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-3)" }}>{c.s}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ width: "100%", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Ventas de hoy</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-3)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Vendido</div>
              <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4 }}>$47.820</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", marginTop: 4 }}>↑ 34% vs ayer</div>
            </div>
            <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-3)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pedidos IA</div>
              <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4 }}>23</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", marginTop: 4 }}>· sin intervención</div>
            </div>
          </div>
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-3)", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--navy))", display: "grid", placeItems: "center", color: "#ffffff", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700 }}>A</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12 }}>Nueva venta cerrada</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-3)" }}>hace 2 min · $12.500</div>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "var(--accent-dim)", color: "var(--accent)" }}>+1</div>
          </div>
        </div>
      )}
    </div>
  );
}
