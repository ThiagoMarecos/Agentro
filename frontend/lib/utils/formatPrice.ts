/**
 * Utilidad centralizada de formateo de precios.
 *
 * Usa Intl.NumberFormat para respetar convenciones regionales:
 *  - PYG (Guaraní): 1.500.000 Gs. (sin decimales, separador de miles con punto)
 *  - ARS (Peso argentino): $ 1.500.000,00
 *  - USD: $1,500,000.00
 *  - BRL: R$ 1.500.000,00
 *  - CLP: $1.500.000 (sin decimales)
 *  - COP: $1.500.000 (sin decimales por convención)
 */

// Mapa de moneda → locale preferido para formateo correcto
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  USD: "en-US",
  EUR: "es-ES",
  ARS: "es-AR",
  MXN: "es-MX",
  COP: "es-CO",
  CLP: "es-CL",
  PEN: "es-PE",
  UYU: "es-UY",
  PYG: "es-PY",
  BRL: "pt-BR",
  GBP: "en-GB",
  VES: "es-VE",
  BOB: "es-BO",
};

// Monedas que NO usan decimales (no tiene sentido mostrar .00 en 1.500.000 Gs.)
const ZERO_DECIMAL_CURRENCIES = new Set(["PYG", "CLP", "JPY", "KRW", "VND"]);

/**
 * Formatea un precio según la moneda de la tienda.
 *
 * @param price    - Valor numérico del precio
 * @param currency - Código ISO 4217 de la moneda (ej: "PYG", "USD", "ARS")
 * @param options  - Opciones adicionales
 * @returns        - String formateado (ej: "₲ 1.500.000", "$ 1.500,00")
 */
export function formatPrice(
  price: number | null | undefined,
  currency: string = "USD",
  options?: {
    /** Mostrar símbolo de moneda (default: true) */
    showSymbol?: boolean;
    /** Forzar número de decimales */
    decimals?: number;
  }
): string {
  if (price == null) return "—";

  const cur = currency.toUpperCase();
  const locale = CURRENCY_LOCALE_MAP[cur] || "es-AR";
  const showSymbol = options?.showSymbol !== false;

  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cur);
  const minDecimals = options?.decimals ?? (isZeroDecimal ? 0 : 0);
  const maxDecimals = options?.decimals ?? (isZeroDecimal ? 0 : 2);

  try {
    if (showSymbol) {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: cur,
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      }).format(price);
    } else {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      }).format(price);
    }
  } catch {
    // Fallback si Intl no reconoce la moneda
    return `${cur} ${price.toLocaleString(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    })}`;
  }
}

/**
 * Formatea un precio de forma compacta para cards de producto (sin símbolo largo).
 * Ej: "Gs. 1.500.000" en vez de "PYG 1.500.000"
 */
export function formatPriceShort(
  price: number | null | undefined,
  currency: string = "USD"
): string {
  return formatPrice(price, currency);
}
