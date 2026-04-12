/**
 * Página de features - Landing pública
 */

import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background landing-bg">
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <img src="/logo-white.png" alt="Agentro" className="h-10 w-auto" />
          </Link>
          <nav className="flex gap-6">
            <Link href="/" className="text-text-muted hover:text-text-primary">Inicio</Link>
            <Link href="/login" className="text-text-muted hover:text-text-primary">Iniciar sesión</Link>
            <Link href="/signup" className="bg-gradient-agentro px-4 py-2 rounded-lg">Registrarse</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="heading-page text-4xl mb-8">Características</h1>
        <p className="text-text-muted mb-12">
          Placeholder para descripción de features del producto.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {["E-commerce", "IA", "Multi-tenant", "Plantillas"].map((f, i) => (
            <div key={i} className="p-6 rounded-xl border border-white/10">
              <h2 className="heading-section text-lg mb-2">{f}</h2>
              <p className="text-text-muted text-sm">Descripción pendiente.</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
