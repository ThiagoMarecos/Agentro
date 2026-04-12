export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <img src="/logo-white.png" alt="Agentro" className="h-10 w-auto mb-6" />
      <h1 className="heading-page text-2xl mb-2">Bienvenido a Agentro</h1>
      <p className="text-text-muted mb-6">
        Vamos a configurar tu tienda en unos pocos pasos.
      </p>
      <button
        onClick={onNext}
        className="bg-gradient-agentro px-6 py-3 rounded-lg font-semibold text-white hover:opacity-90"
      >
        Comenzar
      </button>
    </div>
  );
}
