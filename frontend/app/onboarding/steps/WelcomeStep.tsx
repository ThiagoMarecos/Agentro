export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[11px] font-mono tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
        Onboarding · paso 1 de 6
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/agentro-white.png"
        alt="Agentro"
        className="h-7 w-auto mx-auto mb-6 opacity-95"
        style={{ filter: "drop-shadow(0 0 12px rgba(139,111,255,0.5))" }}
      />

      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-white">
        Bienvenido a{" "}
        <span
          style={{
            background: "linear-gradient(135deg, #b39bff, #8b6fff)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Agentro
        </span>
      </h1>
      <p className="text-base text-slate-300/85 max-w-md mx-auto mb-8 leading-relaxed">
        Vamos a armar tu tienda en pocos pasos. Te tomará menos de 5 minutos y
        después tu IA empieza a vender.
      </p>

      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[#05060f] font-semibold text-sm shadow-[0_0_30px_-4px_rgba(139,111,255,0.5)] hover:bg-[#b39bff] hover:text-white transition-all"
      >
        Comenzar
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      <div className="mt-8 flex items-center justify-center gap-3 text-[11px] font-mono uppercase tracking-wider text-slate-500">
        <span>Beta cerrada</span>
        <span className="w-1 h-1 rounded-full bg-slate-600" />
        <span>Sin tarjeta</span>
        <span className="w-1 h-1 rounded-full bg-slate-600" />
        <span>Sin compromiso</span>
      </div>
    </div>
  );
}
