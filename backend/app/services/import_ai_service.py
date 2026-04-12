"""
Servicio de post-procesamiento con IA para productos importados.

1. Genera descripciones con GPT-4o cuando el scraper no pudo extraer una.
2. Convierte precios de la moneda del sitio a la moneda de la tienda.
"""

import json
import logging
import re
from urllib.parse import urlparse

import httpx
from openai import OpenAI

from app.config import get_settings, get_dynamic_setting

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# Currency detection & conversion
# ────────────────────────────────────────────────────────────────────────────

# Map of currency symbols/codes to ISO 4217
CURRENCY_HINTS: dict[str, str] = {
    "$": "USD",  # ambiguous — resolved by domain/TLD
    "€": "EUR",
    "£": "GBP",
    "₲": "PYG",
    "R$": "BRL",
    "S/.": "PEN",
    "Gs": "PYG",
    "Gs.": "PYG",
    "gs": "PYG",
    "guaraníes": "PYG",
    "guaranies": "PYG",
    "CLP": "CLP",
    "MXN": "MXN",
    "ARS": "ARS",
    "COP": "COP",
    "UYU": "UYU",
    "USD": "USD",
    "EUR": "EUR",
    "GBP": "GBP",
    "PYG": "PYG",
    "BRL": "BRL",
    "PEN": "PEN",
    "BOB": "BOB",
    "VES": "VES",
}

# TLD → likely currency for $ disambiguation
DOMAIN_CURRENCY: dict[str, str] = {
    ".py": "PYG",
    ".com.py": "PYG",
    ".ar": "ARS",
    ".com.ar": "ARS",
    ".cl": "CLP",
    ".co": "COP",
    ".com.co": "COP",
    ".mx": "MXN",
    ".com.mx": "MXN",
    ".br": "BRL",
    ".com.br": "BRL",
    ".pe": "PEN",
    ".com.pe": "PEN",
    ".uy": "UYU",
    ".com.uy": "UYU",
    ".bo": "BOB",
    ".com.bo": "BOB",
    ".ve": "VES",
    ".com.ve": "VES",
    ".us": "USD",
    ".com": "USD",  # default for .com
}


def detect_source_currency(url: str, prices: list[float | None]) -> str:
    """
    Detect the REAL currency of the scraped website.

    Strategy: PRICE MAGNITUDE is the PRIMARY indicator, TLD is secondary.

    Why? Many international brands (Puma, Nike, Adidas) operate .com.py/.com.ar
    domains but price in USD. A product at $58 is OBVIOUSLY USD — 58 PYG doesn't
    exist (a bottle of water costs ~5,000 PYG).

    Currency magnitude ranges (approximate):
    - USD/EUR/GBP: 1 - 5,000 (a car might be 50,000)
    - BRL: 5 - 50,000
    - ARS: 1,000 - 5,000,000 (high inflation)
    - MXN: 50 - 500,000
    - PYG: 5,000 - 50,000,000 (NEVER less than 1,000 for any real product)
    - COP: 5,000 - 50,000,000 (similar to PYG)
    - CLP: 1,000 - 10,000,000
    """
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()

    valid_prices = [p for p in prices if p and p > 0]
    if not valid_prices:
        # No prices → fallback to TLD
        return _currency_from_tld(host)

    avg_price = sum(valid_prices) / len(valid_prices)
    max_price = max(valid_prices)
    min_price = min(valid_prices)

    # ── RULE 1: Very low prices (< 1,000) = ALWAYS USD/EUR ──
    # No product in PYG, COP, CLP, ARS costs less than 1,000 in local currency
    if max_price < 1000:
        logger.info(f"Prices are low (avg={avg_price:.0f}, max={max_price:.0f}) → USD")
        return "USD"

    # ── RULE 2: Very high prices (> 100,000) = local currency ──
    # No product costs $100,000 USD on a regular store
    if min_price > 50000:
        tld_currency = _currency_from_tld(host)
        if tld_currency != "USD":
            logger.info(f"Prices are very high (avg={avg_price:.0f}) → {tld_currency}")
            return tld_currency
        # .com with very high prices — try to guess
        if avg_price > 500000:
            logger.info(f"Prices extremely high on .com (avg={avg_price:.0f}) → PYG/COP heuristic")
            if any(kw in host for kw in ("paraguay", "py", "asuncion", "guarani")):
                return "PYG"
            if any(kw in host for kw in ("colombia", "bogota", "medellin")):
                return "COP"
        return "USD"

    # ── RULE 3: Medium prices (1,000 - 50,000) = ambiguous ──
    # Could be USD (expensive items) or local currency (cheap items)
    # Use TLD as tiebreaker, BUT validate with magnitude
    tld_currency = _currency_from_tld(host)

    if tld_currency in ("PYG", "COP"):
        # PYG/COP products are NEVER this cheap (1,000-50,000)
        # A single candy costs ~2,000 PYG minimum, but full products > 10,000
        if avg_price < 5000:
            logger.info(f"Prices too low for {tld_currency} (avg={avg_price:.0f}) → USD")
            return "USD"
        # 5,000 - 50,000 could be very cheap local products
        logger.info(f"Medium prices on {tld_currency} domain (avg={avg_price:.0f}) → {tld_currency}")
        return tld_currency

    if tld_currency == "ARS":
        # ARS products range 1,000 - 5,000,000 (inflation)
        if avg_price < 500:
            return "USD"
        return "ARS"

    if tld_currency == "CLP":
        if avg_price < 500:
            return "USD"
        return "CLP"

    if tld_currency == "BRL":
        if avg_price < 10:
            return "USD"
        return "BRL"

    if tld_currency == "MXN":
        if avg_price < 20:
            return "USD"
        return "MXN"

    logger.info(f"Default: avg_price={avg_price:.0f} → USD")
    return "USD"


def _currency_from_tld(host: str) -> str:
    """Get likely currency from domain TLD."""
    for tld, currency in DOMAIN_CURRENCY.items():
        if host.endswith(tld) and tld != ".com":
            return currency
    return "USD"


# Cache exchange rates for the session (avoid multiple API calls)
_exchange_rate_cache: dict[str, float] = {}


def get_exchange_rate(from_currency: str, to_currency: str) -> float | None:
    """
    Get current exchange rate using free APIs.
    Returns the multiplier to convert from_currency → to_currency.
    """
    if from_currency == to_currency:
        return 1.0

    cache_key = f"{from_currency}_{to_currency}"
    if cache_key in _exchange_rate_cache:
        return _exchange_rate_cache[cache_key]

    # Try multiple free APIs
    apis = [
        # frankfurter.app — free, no key needed, ECB rates
        f"https://api.frankfurter.app/latest?from={from_currency}&to={to_currency}",
        # exchangerate.host — free tier
        f"https://api.exchangerate.host/latest?base={from_currency}&symbols={to_currency}",
    ]

    for api_url in apis:
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(api_url)
                if resp.status_code != 200:
                    continue
                data = resp.json()

                # frankfurter format
                rates = data.get("rates", {})
                if to_currency in rates:
                    rate = float(rates[to_currency])
                    _exchange_rate_cache[cache_key] = rate
                    logger.info(f"Exchange rate {from_currency} → {to_currency}: {rate}")
                    return rate
        except Exception as e:
            logger.warning(f"Exchange rate API failed ({api_url}): {e}")
            continue

    # Hardcoded fallback rates (updated periodically)
    # These are approximate and should be overridden by API
    FALLBACK_RATES: dict[str, dict[str, float]] = {
        "USD": {
            "PYG": 7350,  # ~7350 PYG per USD (approximate)
            "ARS": 1050,
            "BRL": 5.0,
            "CLP": 950,
            "COP": 4200,
            "MXN": 17.5,
            "PEN": 3.75,
            "UYU": 40,
            "EUR": 0.92,
            "GBP": 0.79,
        },
    }

    # Try direct fallback
    if from_currency in FALLBACK_RATES and to_currency in FALLBACK_RATES[from_currency]:
        rate = FALLBACK_RATES[from_currency][to_currency]
        _exchange_rate_cache[cache_key] = rate
        logger.info(f"Exchange rate (fallback) {from_currency} → {to_currency}: {rate}")
        return rate

    # Try inverse fallback
    if to_currency in FALLBACK_RATES and from_currency in FALLBACK_RATES[to_currency]:
        rate = 1.0 / FALLBACK_RATES[to_currency][from_currency]
        _exchange_rate_cache[cache_key] = rate
        logger.info(f"Exchange rate (inverse fallback) {from_currency} → {to_currency}: {rate}")
        return rate

    logger.warning(f"Could not get exchange rate for {from_currency} → {to_currency}")
    return None


def convert_prices(
    products: list[dict],
    source_currency: str,
    target_currency: str,
) -> list[dict]:
    """
    Convert all product prices from source_currency to target_currency.
    Modifies products in place and returns them.
    """
    if source_currency == target_currency:
        return products

    rate = get_exchange_rate(source_currency, target_currency)
    if not rate:
        logger.warning(f"No exchange rate found, keeping original prices")
        return products

    logger.info(f"Converting prices: {source_currency} → {target_currency} (rate: {rate})")

    for product in products:
        if product.get("price") is not None:
            product["price"] = round(product["price"] * rate, 2)
            # For zero-decimal currencies, round to integer
            if target_currency in ("PYG", "CLP", "JPY", "KRW", "VND"):
                product["price"] = round(product["price"])

        if product.get("compare_at_price") is not None:
            product["compare_at_price"] = round(product["compare_at_price"] * rate, 2)
            if target_currency in ("PYG", "CLP", "JPY", "KRW", "VND"):
                product["compare_at_price"] = round(product["compare_at_price"])

    return products


# ────────────────────────────────────────────────────────────────────────────
# AI Description Generation
# ────────────────────────────────────────────────────────────────────────────

def generate_missing_descriptions(
    products: list[dict],
    store_currency: str = "USD",
    source_url: str = "",
) -> list[dict]:
    """
    Use GPT-4o to generate REAL, DETAILED descriptions for products
    that are missing one or have a very short/junk description.

    The AI receives the FULL product name (which usually contains brand, model,
    color, size, etc.) and must generate a description with REAL specifications
    that match the actual product. For example:
    - "PUMA RS-X Reinvention White" → real RS-X specs (weight, sole, materials)
    - "Apple iPhone 17 Pro Max 256GB" → real screen size, chip, camera specs
    - "Samsung Galaxy S26 Ultra" → real specs

    Processes ALL products needing descriptions in a single API call.
    """
    settings = get_settings()
    openai_key = get_dynamic_setting("openai_api_key")

    if not openai_key:
        logger.warning("OpenAI API key not configured — skipping AI descriptions")
        return products

    # Find products needing descriptions
    needs_description = []
    for i, p in enumerate(products):
        desc = (p.get("description") or "").strip()
        if not desc or len(desc) < 30:
            needs_description.append((i, p))

    if not needs_description:
        logger.info("All products have descriptions — no AI generation needed")
        return products

    logger.info(f"Generating AI descriptions for {len(needs_description)}/{len(products)} products")

    # Build DETAILED product list for the prompt — include ALL available info
    product_entries = []
    for idx, (i, p) in enumerate(needs_description):
        name = p.get("name", "Producto desconocido")
        sku = p.get("sku") or ""
        price = p.get("price")
        existing_desc = (p.get("description") or "").strip()

        entry = f"{idx + 1}. Nombre EXACTO: \"{name}\""
        if sku:
            entry += f"\n   SKU: {sku}"
        if price:
            entry += f"\n   Precio: {price:,.0f} {store_currency}"
        if existing_desc:
            entry += f"\n   Info parcial: {existing_desc[:200]}"
        product_entries.append(entry)

    products_text = "\n\n".join(product_entries)

    try:
        client = OpenAI(api_key=openai_key)

        system_prompt = (
            "Sos un experto en productos de consumo con conocimiento enciclopédico de marcas, "
            "modelos y especificaciones técnicas. Tu trabajo es generar descripciones REALES y "
            "PRECISAS para productos de una tienda online.\n\n"
            "REGLAS CRÍTICAS:\n"
            "1. ANALIZÁ el nombre completo del producto — contiene marca, modelo, variante, color, "
            "talle, capacidad, etc. Usá TODA esa información.\n"
            "2. Si RECONOCÉS el producto (Nike, Puma, Apple, Samsung, etc.), escribí las "
            "ESPECIFICACIONES REALES del modelo exacto (materiales, tecnologías, dimensiones, "
            "peso, características técnicas, etc.).\n"
            "3. Si NO reconocés el producto exacto, inferí sus características por la marca, "
            "categoría y nombre, y generá una descripción coherente.\n"
            "4. NUNCA inventes specs falsas. Si no estás seguro de un dato específico, "
            "mencioná la característica de forma general.\n"
            "5. Cada descripción: 3-6 oraciones, 100-400 caracteres, en español latinoamericano.\n"
            "6. Tono profesional de e-commerce, enfocado en beneficios para el comprador.\n"
            "7. Devolvé SOLO JSON válido, sin markdown ni texto extra."
        )

        user_prompt = f"""Necesito descripciones REALES y DETALLADAS para estos {len(needs_description)} productos:
{f"(Fuente: {source_url})" if source_url else ""}

{products_text}

Devolvé un JSON con esta estructura exacta:
{{
  "descriptions": [
    "Descripción real y detallada del producto 1...",
    "Descripción real y detallada del producto 2...",
  ]
}}

EJEMPLOS de buenas descripciones:
- Para "PUMA RS-X Reinvention White/Red": "Las PUMA RS-X Reinvention combinan el icónico diseño chunky de los 80 con tecnología moderna Running System. Cuenta con entresuela de EVA para amortiguación superior, upper de malla y cuero sintético, y suela de goma para tracción duradera. Color White/Red con detalles reflectivos."
- Para "Apple iPhone 15 Pro Max 256GB": "iPhone 15 Pro Max con chip A17 Pro, pantalla Super Retina XDR de 6.7 pulgadas con ProMotion de 120Hz. Sistema de cámaras Pro con principal de 48MP, ultra gran angular y teleobjetivo 5x. Cuerpo de titanio, puerto USB-C y hasta 29 horas de reproducción de video."
- Para "Samsung 55\" Crystal UHD 4K": "Smart TV Samsung de 55 pulgadas con resolución Crystal UHD 4K y procesador Crystal 4K para colores vívidos y detalles nítidos. Compatible con Alexa y Google Assistant, sistema operativo Tizen con acceso a streaming. HDR10+ para contraste superior."

La cantidad de descripciones debe ser EXACTAMENTE {len(needs_description)}.
"""

        response = client.chat.completions.create(
            model=settings.openai_default_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.5,  # Lower temp for more factual/accurate descriptions
            timeout=45,
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)
        descriptions = result.get("descriptions", [])

        # Apply descriptions to products
        applied = 0
        for idx, (i, p) in enumerate(needs_description):
            if idx < len(descriptions) and descriptions[idx]:
                products[i]["description"] = descriptions[idx].strip()[:2000]
                applied += 1
                logger.debug(f"AI description for '{p.get('name')}': {descriptions[idx][:80]}...")

        logger.info(f"AI generated {applied} descriptions successfully")

    except Exception as e:
        logger.error(f"AI description generation failed: {e}")
        # Don't fail the whole import — just skip AI descriptions

    return products
