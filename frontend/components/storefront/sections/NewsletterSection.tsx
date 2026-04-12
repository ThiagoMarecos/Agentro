"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface NewsletterSectionProps {
  config: {
    title?: string;
    description?: string;
  };
}

export function NewsletterSection({ config }: NewsletterSectionProps) {
  const [email, setEmail] = useState("");

  const title = config.title || "Suscríbete a nuestro newsletter";
  const description = config.description || "Recibe las últimas novedades y ofertas exclusivas directamente en tu correo.";

  return (
    <section
      className="py-16 md:py-20"
      style={{ backgroundColor: "var(--color-primary)" }}
    >
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2
          className="text-2xl md:text-3xl font-bold mb-4"
          style={{ color: "var(--color-primary-fg)" }}
        >
          {title}
        </h2>
        <p
          className="mb-8 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          {description}
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="flex-1 px-5 py-3 rounded-full text-sm outline-none transition-shadow focus:ring-2"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              color: "var(--color-text)",
              ringColor: "var(--color-accent)",
            }}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-accent-fg)",
            }}
          >
            Suscribirse
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
