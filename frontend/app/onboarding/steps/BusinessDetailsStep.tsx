"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Globe, DollarSign, Languages, Briefcase, Check } from "lucide-react";

const COUNTRIES = [
  { code: "AF", name: "Afganistán", flag: "🇦🇫" },
  { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "DE", name: "Alemania", flag: "🇩🇪" },
  { code: "AD", name: "Andorra", flag: "🇦🇩" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "AG", name: "Antigua y Barbuda", flag: "🇦🇬" },
  { code: "SA", name: "Arabia Saudita", flag: "🇸🇦" },
  { code: "DZ", name: "Argelia", flag: "🇩🇿" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaiyán", flag: "🇦🇿" },
  { code: "BS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BD", name: "Bangladés", flag: "🇧🇩" },
  { code: "BB", name: "Barbados", flag: "🇧🇧" },
  { code: "BH", name: "Baréin", flag: "🇧🇭" },
  { code: "BE", name: "Bélgica", flag: "🇧🇪" },
  { code: "BZ", name: "Belice", flag: "🇧🇿" },
  { code: "BJ", name: "Benín", flag: "🇧🇯" },
  { code: "BY", name: "Bielorrusia", flag: "🇧🇾" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BA", name: "Bosnia y Herzegovina", flag: "🇧🇦" },
  { code: "BW", name: "Botsuana", flag: "🇧🇼" },
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "BN", name: "Brunéi", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "KH", name: "Camboya", flag: "🇰🇭" },
  { code: "CM", name: "Camerún", flag: "🇨🇲" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
  { code: "QA", name: "Catar", flag: "🇶🇦" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CY", name: "Chipre", flag: "🇨🇾" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "KR", name: "Corea del Sur", flag: "🇰🇷" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "HR", name: "Croacia", flag: "🇭🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "DK", name: "Dinamarca", flag: "🇩🇰" },
  { code: "DO", name: "República Dominicana", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egipto", flag: "🇪🇬" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "AE", name: "Emiratos Árabes Unidos", flag: "🇦🇪" },
  { code: "SK", name: "Eslovaquia", flag: "🇸🇰" },
  { code: "SI", name: "Eslovenia", flag: "🇸🇮" },
  { code: "ES", name: "España", flag: "🇪🇸" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "ET", name: "Etiopía", flag: "🇪🇹" },
  { code: "PH", name: "Filipinas", flag: "🇵🇭" },
  { code: "FI", name: "Finlandia", flag: "🇫🇮" },
  { code: "FR", name: "Francia", flag: "🇫🇷" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GR", name: "Grecia", flag: "🇬🇷" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "GY", name: "Guyana", flag: "🇬🇾" },
  { code: "HT", name: "Haití", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "HU", name: "Hungría", flag: "🇭🇺" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IQ", name: "Irak", flag: "🇮🇶" },
  { code: "IR", name: "Irán", flag: "🇮🇷" },
  { code: "IE", name: "Irlanda", flag: "🇮🇪" },
  { code: "IS", name: "Islandia", flag: "🇮🇸" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italia", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japón", flag: "🇯🇵" },
  { code: "JO", name: "Jordania", flag: "🇯🇴" },
  { code: "KZ", name: "Kazajistán", flag: "🇰🇿" },
  { code: "KE", name: "Kenia", flag: "🇰🇪" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "LV", name: "Letonia", flag: "🇱🇻" },
  { code: "LB", name: "Líbano", flag: "🇱🇧" },
  { code: "LT", name: "Lituania", flag: "🇱🇹" },
  { code: "LU", name: "Luxemburgo", flag: "🇱🇺" },
  { code: "MY", name: "Malasia", flag: "🇲🇾" },
  { code: "MA", name: "Marruecos", flag: "🇲🇦" },
  { code: "MX", name: "México", flag: "🇲🇽" },
  { code: "MD", name: "Moldavia", flag: "🇲🇩" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" },
  { code: "ME", name: "Montenegro", flag: "🇲🇪" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "NO", name: "Noruega", flag: "🇳🇴" },
  { code: "NZ", name: "Nueva Zelanda", flag: "🇳🇿" },
  { code: "NL", name: "Países Bajos", flag: "🇳🇱" },
  { code: "PK", name: "Pakistán", flag: "🇵🇰" },
  { code: "PA", name: "Panamá", flag: "🇵🇦" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PE", name: "Perú", flag: "🇵🇪" },
  { code: "PL", name: "Polonia", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷" },
  { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { code: "CZ", name: "República Checa", flag: "🇨🇿" },
  { code: "RO", name: "Rumanía", flag: "🇷🇴" },
  { code: "RU", name: "Rusia", flag: "🇷🇺" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SG", name: "Singapur", flag: "🇸🇬" },
  { code: "ZA", name: "Sudáfrica", flag: "🇿🇦" },
  { code: "SE", name: "Suecia", flag: "🇸🇪" },
  { code: "CH", name: "Suiza", flag: "🇨🇭" },
  { code: "SR", name: "Surinam", flag: "🇸🇷" },
  { code: "TH", name: "Tailandia", flag: "🇹🇭" },
  { code: "TW", name: "Taiwán", flag: "🇹🇼" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "TT", name: "Trinidad y Tobago", flag: "🇹🇹" },
  { code: "TN", name: "Túnez", flag: "🇹🇳" },
  { code: "TR", name: "Turquía", flag: "🇹🇷" },
  { code: "UA", name: "Ucrania", flag: "🇺🇦" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
];

const CURRENCIES = [
  { code: "USD", name: "Dólar estadounidense", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "Libra esterlina", symbol: "£" },
  { code: "MXN", name: "Peso mexicano", symbol: "$" },
  { code: "ARS", name: "Peso argentino", symbol: "$" },
  { code: "COP", name: "Peso colombiano", symbol: "$" },
  { code: "CLP", name: "Peso chileno", symbol: "$" },
  { code: "PEN", name: "Sol peruano", symbol: "S/" },
  { code: "BRL", name: "Real brasileño", symbol: "R$" },
  { code: "PYG", name: "Guaraní paraguayo", symbol: "₲" },
  { code: "UYU", name: "Peso uruguayo", symbol: "$U" },
  { code: "BOB", name: "Boliviano", symbol: "Bs" },
  { code: "VES", name: "Bolívar venezolano", symbol: "Bs.S" },
  { code: "GTQ", name: "Quetzal guatemalteco", symbol: "Q" },
  { code: "HNL", name: "Lempira hondureño", symbol: "L" },
  { code: "NIO", name: "Córdoba nicaragüense", symbol: "C$" },
  { code: "CRC", name: "Colón costarricense", symbol: "₡" },
  { code: "PAB", name: "Balboa panameño", symbol: "B/." },
  { code: "DOP", name: "Peso dominicano", symbol: "RD$" },
  { code: "CAD", name: "Dólar canadiense", symbol: "CA$" },
  { code: "AUD", name: "Dólar australiano", symbol: "A$" },
  { code: "JPY", name: "Yen japonés", symbol: "¥" },
  { code: "CNY", name: "Yuan chino", symbol: "¥" },
  { code: "KRW", name: "Won surcoreano", symbol: "₩" },
  { code: "INR", name: "Rupia india", symbol: "₹" },
  { code: "CHF", name: "Franco suizo", symbol: "CHF" },
  { code: "SEK", name: "Corona sueca", symbol: "kr" },
  { code: "NOK", name: "Corona noruega", symbol: "kr" },
  { code: "DKK", name: "Corona danesa", symbol: "kr" },
  { code: "PLN", name: "Zloty polaco", symbol: "zł" },
  { code: "TRY", name: "Lira turca", symbol: "₺" },
  { code: "ZAR", name: "Rand sudafricano", symbol: "R" },
  { code: "ILS", name: "Séquel israelí", symbol: "₪" },
  { code: "AED", name: "Dirham de los EAU", symbol: "د.إ" },
  { code: "SAR", name: "Riyal saudí", symbol: "﷼" },
  { code: "NGN", name: "Naira nigeriana", symbol: "₦" },
  { code: "EGP", name: "Libra egipcia", symbol: "E£" },
  { code: "THB", name: "Baht tailandés", symbol: "฿" },
  { code: "MYR", name: "Ringgit malayo", symbol: "RM" },
  { code: "PHP", name: "Peso filipino", symbol: "₱" },
  { code: "IDR", name: "Rupia indonesia", symbol: "Rp" },
  { code: "TWD", name: "Dólar taiwanés", symbol: "NT$" },
  { code: "SGD", name: "Dólar singapurense", symbol: "S$" },
  { code: "HKD", name: "Dólar hongkonés", symbol: "HK$" },
  { code: "NZD", name: "Dólar neozelandés", symbol: "NZ$" },
];

const LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "Inglés" },
  { code: "pt", name: "Portugués" },
  { code: "fr", name: "Francés" },
  { code: "de", name: "Alemán" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "Japonés" },
  { code: "ko", name: "Coreano" },
  { code: "zh", name: "Chino" },
  { code: "ar", name: "Árabe" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turco" },
  { code: "nl", name: "Neerlandés" },
  { code: "pl", name: "Polaco" },
  { code: "ru", name: "Ruso" },
];

// Auto-suggest currency based on country
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", MX: "MXN", ES: "EUR", AR: "ARS", CO: "COP", CL: "CLP",
  PE: "PEN", BR: "BRL", PY: "PYG", UY: "UYU", BO: "BOB", VE: "VES",
  GT: "GTQ", HN: "HNL", NI: "NIO", CR: "CRC", PA: "PAB", DO: "DOP",
  CA: "CAD", GB: "GBP", AU: "AUD", JP: "JPY", CN: "CNY", KR: "KRW",
  IN: "INR", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  TR: "TRY", ZA: "ZAR", IL: "ILS", AE: "AED", SA: "SAR", NG: "NGN",
  EG: "EGP", TH: "THB", MY: "MYR", PH: "PHP", ID: "IDR", TW: "TWD",
  SG: "SGD", HK: "HKD", NZ: "NZD", FR: "EUR", DE: "EUR", IT: "EUR",
  PT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", IE: "EUR", FI: "EUR",
  GR: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", SK: "EUR", SI: "EUR",
  LU: "EUR", CY: "EUR", RO: "RON", HU: "HUF", CZ: "CZK", BG: "BGN",
  RU: "RUB", UA: "UAH", RS: "RSD", HR: "EUR", BA: "BAM", ME: "EUR",
  AL: "ALL", GE: "GEL", AM: "AMD", AZ: "AZN", KZ: "KZT", MD: "MDL",
  BY: "BYN", MN: "MNT", QA: "QAR", KW: "KWD", BH: "BHD", JO: "JOD",
  LB: "LBP", IQ: "IQD", IR: "IRR", MA: "MAD", TN: "TND", DZ: "DZD",
  KE: "KES", TZ: "TZS", UG: "UGX", GH: "GHS", SN: "XOF", CM: "XAF",
  MZ: "MZN", AO: "AOA", ET: "ETB", BW: "BWP", NP: "NPR", BD: "BDT",
  PK: "PKR", MM: "MMK", KH: "KHR", VN: "VND", CU: "CUP", HT: "HTG",
  JM: "JMD", TT: "TTD", BB: "BBD", GY: "GYD", SR: "SRD", BZ: "BZD",
  BS: "BSD", PR: "USD", BN: "BND", IS: "ISK",
};

function SearchableSelect({
  label,
  icon: Icon,
  value,
  onChange,
  options,
  renderOption,
  renderSelected,
  placeholder,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (val: string) => void;
  options: { code: string; name: string; [key: string]: string }[];
  renderOption: (opt: { code: string; name: string; [key: string]: string }) => React.ReactNode;
  renderSelected: (opt: { code: string; name: string; [key: string]: string }) => React.ReactNode;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.code === value);

  const filtered = search
    ? options.filter(
        (o) =>
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          o.code.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium mb-2 text-text-primary">
        <Icon className="w-4 h-4 text-primary" />
        {label}
      </label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => { setOpen(!open); setSearch(""); }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.12] hover:border-primary/50 focus:border-primary focus:outline-none transition-colors text-left"
        >
          <span className="text-sm text-text-primary">
            {selected ? renderSelected(selected) : <span className="text-text-muted">{placeholder}</span>}
          </span>
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/[0.12] bg-surface shadow-2xl shadow-black/40 overflow-hidden">
            <div className="p-2 border-b border-white/[0.08]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-text-muted">
                  No se encontraron resultados
                </div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => { onChange(opt.code); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-white/[0.06] transition-colors ${
                      opt.code === value ? "bg-primary/10 text-primary" : "text-text-primary"
                    }`}
                  >
                    {renderOption(opt)}
                    {opt.code === value && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [country, setCountry] = useState(data?.country || "");
  const [currency, setCurrency] = useState(data?.currency || "USD");
  const [language, setLanguage] = useState(data?.language || "es");

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const suggested = COUNTRY_CURRENCY[code];
    if (suggested) {
      const exists = CURRENCIES.find((c) => c.code === suggested);
      if (exists) setCurrency(suggested);
    }
  };

  const handleNext = () => {
    setData?.({ industry, country, currency, language });
    onNext();
  };

  return (
    <div>
      <h1 className="heading-page text-2xl mb-1">Configuración regional</h1>
      <p className="text-text-muted text-sm mb-8">
        Elegí tu país y moneda para personalizar tu tienda
      </p>

      <div className="space-y-5">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2 text-text-primary">
            <Briefcase className="w-4 h-4 text-primary" />
            Rubro / Industria
          </label>
          <input
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.12] hover:border-primary/50 focus:border-primary focus:outline-none transition-colors text-sm"
            placeholder="Moda, electrónica, alimentos..."
          />
        </div>

        <SearchableSelect
          label="País"
          icon={Globe}
          value={country}
          onChange={handleCountryChange}
          options={COUNTRIES}
          placeholder="Seleccioná tu país"
          renderOption={(opt) => (
            <span className="flex items-center gap-3">
              <span className="text-lg leading-none">{opt.flag}</span>
              <span>{opt.name}</span>
              <span className="text-text-muted text-xs">{opt.code}</span>
            </span>
          )}
          renderSelected={(opt) => (
            <span className="flex items-center gap-3">
              <span className="text-lg leading-none">{opt.flag}</span>
              <span>{opt.name}</span>
            </span>
          )}
        />

        <SearchableSelect
          label="Moneda"
          icon={DollarSign}
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES}
          placeholder="Seleccioná tu moneda"
          renderOption={(opt) => (
            <span className="flex items-center gap-3">
              <span className="w-7 text-center font-mono text-text-muted">{opt.symbol}</span>
              <span>{opt.name}</span>
              <span className="text-text-muted text-xs">{opt.code}</span>
            </span>
          )}
          renderSelected={(opt) => (
            <span className="flex items-center gap-2">
              <span className="font-mono text-text-muted">{opt.symbol}</span>
              <span>{opt.name}</span>
              <span className="text-text-muted text-xs">({opt.code})</span>
            </span>
          )}
        />

        <SearchableSelect
          label="Idioma"
          icon={Languages}
          value={language}
          onChange={setLanguage}
          options={LANGUAGES}
          placeholder="Seleccioná el idioma"
          renderOption={(opt) => <span>{opt.name}</span>}
          renderSelected={(opt) => <span>{opt.name}</span>}
        />
      </div>

      <div className="mt-10 flex gap-3">
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-white/[0.15] hover:bg-white/[0.04] transition-colors text-sm font-medium"
        >
          Atrás
        </button>
        <button
          onClick={handleNext}
          className="flex-1 bg-gradient-agentro px-6 py-3 rounded-xl font-semibold text-white hover:opacity-90 transition-opacity text-sm"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
