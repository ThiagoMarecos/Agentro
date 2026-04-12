"use client";

import { useState } from "react";

const COUNTRIES = [
  { code: "US", name: "Estados Unidos" },
  { code: "MX", name: "México" },
  { code: "ES", name: "España" },
  { code: "AR", name: "Argentina" },
  { code: "CO", name: "Colombia" },
];

const CURRENCIES = [
  { code: "USD", name: "USD" },
  { code: "EUR", name: "EUR" },
  { code: "MXN", name: "MXN" },
  { code: "ARS", name: "ARS" },
];

const LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "Inglés" },
];

export function BusinessDetailsStep({
  onNext,
  onBack,
  data,
  setData,
}: {
  onNext: () => void;
  onBack: () => void;
  data?: { industry?: string; country?: string; currency?: string; language?: string };
  setData?: (d: object) => void;
}) {
  const [industry, setIndustry] = useState(data?.industry || "");
  const [country, setCountry] = useState(data?.country || "US");
  const [currency, setCurrency] = useState(data?.currency || "USD");
  const [language, setLanguage] = useState(data?.language || "es");

  const handleNext = () => {
    setData?.({ industry, country, currency, language });
    onNext();
  };

  return (
    <div>
      <h1 className="heading-page text-2xl mb-2">Detalles del negocio</h1>
      <p className="text-text-muted mb-6">
        Configuración regional de tu tienda
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Rubro / Industria</label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
            placeholder="Moda, electrónica, etc."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">País</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Idioma</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-8 flex gap-4">
        <button onClick={onBack} className="px-6 py-3 rounded-lg border border-white/20 hover:bg-white/5">
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="bg-gradient-nexora px-6 py-3 rounded-lg font-semibold text-white hover:opacity-90"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
