"use client";

export type TemplateVariant = "clasico" | "audaz" | "profesional";

interface TemplateCardProps {
  id: string;
  name: string;
  description: string;
  variant: TemplateVariant;
}

function StorefrontMockup({ variant }: { variant: TemplateVariant }) {
  const styles = {
    clasico: {
      bg: "bg-amber-950/40",
      header: "bg-amber-900/30 border-amber-700/30",
      nav: "text-amber-200/80",
      card: "bg-amber-800/20 border-amber-700/20 rounded",
      footer: "bg-amber-900/20 border-amber-700/20",
    },
    audaz: {
      bg: "bg-primary/10",
      header: "bg-primary/30 border-primary/50",
      nav: "text-white",
      card: "bg-primary/20 border-primary/40 rounded-lg",
      footer: "bg-primary/25 border-primary/40",
    },
    profesional: {
      bg: "bg-slate-800/30",
      header: "bg-slate-700/40 border-slate-600/30",
      nav: "text-slate-300",
      card: "bg-slate-600/20 border-slate-500/30 rounded-sm",
      footer: "bg-slate-700/30 border-slate-600/30",
    },
  };

  const s = styles[variant];

  return (
    <div className={`${s.bg} rounded-xl overflow-hidden border border-white/5`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-b ${s.header}`}>
        <span className="text-[10px] font-semibold opacity-90">Mi Tienda</span>
        <div className={`flex gap-1.5 text-[8px] ${s.nav}`}>
          <span>Inicio</span>
          <span>Productos</span>
          <span>Contacto</span>
        </div>
      </div>
      {/* Product grid 2x2 */}
      <div className="grid grid-cols-2 gap-1 p-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${s.card} aspect-[3/4] flex flex-col overflow-hidden`}>
            <div className="flex-1 bg-white/5" />
            <div className="h-3 px-1 flex items-center">
              <span className="text-[7px] opacity-70 truncate">Producto {i}</span>
            </div>
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className={`px-2 py-1 border-t ${s.footer}`}>
        <span className="text-[7px] opacity-60">© Mi Tienda</span>
      </div>
    </div>
  );
}

export function TemplateCard({ id, name, description, variant }: TemplateCardProps) {
  return (
    <div className="group p-6 rounded-2xl glass-light hover:border-white/20 hover:scale-[1.02] transition-all duration-300">
      <div className="h-36 mb-4">
        <StorefrontMockup variant={variant} />
      </div>
      <h3 className="heading-section mb-2">{name}</h3>
      <p className="text-sm text-text-muted">{description}</p>
    </div>
  );
}
