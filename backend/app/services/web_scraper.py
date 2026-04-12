"""
Servicio de web scraping para importar productos, diseño y secciones desde URLs externas.

Funciona con CUALQUIER tecnología web:
- HTML estático, SSR (Next.js SSR, Nuxt SSR, PHP, Rails, Django)
- JavaScript SPAs (React, Vue, Angular, Svelte, Solid)
- Headless commerce (Shopify Hydrogen, Medusa, Saleor)
- Plataformas (Shopify, WooCommerce, Tiendanube, MercadoLibre, Wix, Webflow)
- Sitios con protección anti-bot (Cloudflare, etc.)
- Infinite scroll, lazy loading, contenido dinámico

Estrategia en 2 fases:

FASE 1 — HTTP rápido (httpx):
  1. JSON-LD / Schema.org
  2. Extruct (microdata, RDFa)
  3. HTML heurísticas para product cards
  4. AJAX discovery — buscar endpoints JS y fetchear productos dinámicos
  5. Detección genérica de grillas repetitivas
  6. OpenGraph como producto individual
  7. Sitemap discovery

FASE 2 — Browser rendering (Playwright/Chromium) — solo si Fase 1 encontró pocos resultados:
  8. Renderiza la página con Chromium headless (ejecuta JS completo)
  9. Intercepta respuestas XHR/fetch con JSON de productos
  10. Scroll automático para lazy loading / infinite scroll
  11. Re-aplica estrategias 1-5 sobre el HTML renderizado
"""

import re
import json
import logging
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from ipaddress import ip_address, ip_network

import httpx
from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)

SCRAPE_TIMEOUT = 30
MAX_SITEMAP_PRODUCTS = 30
MAX_TOTAL_SCRAPE_TIME = 150  # seconds — hard limit for the entire scrape_url call

BROWSER_PROFILES = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "DNT": "1",
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
    },
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "DNT": "1",
    },
]

REQUEST_HEADERS = BROWSER_PROFILES[0]

PRIVATE_NETWORKS = [
    ip_network("127.0.0.0/8"),
    ip_network("10.0.0.0/8"),
    ip_network("172.16.0.0/12"),
    ip_network("192.168.0.0/16"),
    ip_network("169.254.0.0/16"),
    ip_network("::1/128"),
]


@dataclass
class ScrapedProduct:
    name: str
    description: str | None = None
    price: float | None = None
    compare_at_price: float | None = None
    image_urls: list[str] = field(default_factory=list)
    sku: str | None = None
    stock_quantity: int | None = None  # Extracted stock/inventory if available
    detail_url: str | None = None  # URL de la página individual del producto


@dataclass
class ScrapedDesign:
    logo_url: str | None = None
    favicon_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    background_color: str | None = None
    text_color: str | None = None
    font_heading: str | None = None
    font_body: str | None = None


@dataclass
class ScrapedSection:
    type: str
    images: list[str] = field(default_factory=list)
    texts: list[str] = field(default_factory=list)


@dataclass
class ScrapeResult:
    store_name: str | None = None
    products: list[ScrapedProduct] = field(default_factory=list)
    design: ScrapedDesign = field(default_factory=ScrapedDesign)
    sections: list[ScrapedSection] = field(default_factory=list)
    detected_currency: str | None = None  # ISO 4217 from JSON-LD priceCurrency or meta tag


def _validate_url(url: str) -> str:
    """Valida URL y previene SSRF."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL inválida")

    try:
        addr = ip_address(hostname)
        for net in PRIVATE_NETWORKS:
            if addr in net:
                raise ValueError("No se permiten direcciones privadas")
    except ValueError as e:
        if "No se permiten" in str(e):
            raise
        # hostname is not an IP — that's fine

    return url


def _abs(base: str, href: str | None) -> str | None:
    if not href:
        return None
    if href.startswith("data:"):
        return None
    return urljoin(base, href)


def _parse_price(text: str | None) -> float | None:
    """Parse the FIRST price found in a text string.
    Handles: "$16.990", "Gs. 1.234.567", "$16 $26" (takes first), "USD 29,99", etc.
    """
    if not text:
        return None
    text = str(text).strip()

    # Find the FIRST price pattern (currency symbol + number, or just a number with decimals)
    # This prevents "$16 $26" from becoming "1626"
    price_patterns = [
        # $16.990 or $ 16.990 or USD 29,99
        r"(?:[\$€£₲]|USD|EUR|GBP|PYG|ARS|BRL|CLP|MXN|COP|PEN|UYU)\s*([\d.,]+)",
        # 16.990 Gs or 16990 guaraníes
        r"([\d.,]+)\s*(?:Gs\.?|guaraní|pesos|soles|reais)",
        # Just a number with dots/commas (fallback)
        r"([\d]+[.,][\d.,]*[\d])",
        # Plain integer
        r"([\d]+)",
    ]

    for pattern in price_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            num_str = match.group(1)
            # Normalize: determine if comma or dot is the decimal separator
            # Count dots and commas
            dots = num_str.count(".")
            commas = num_str.count(",")

            if commas == 1 and dots == 0:
                # "29,99" → comma is decimal
                num_str = num_str.replace(",", ".")
            elif dots == 1 and commas == 0:
                # "29.99" or "1.234" — if digits after dot are exactly 3 and there's
                # no other separator, it's likely a thousands separator
                after_dot = num_str.split(".")[1]
                before_dot = num_str.split(".")[0]
                if len(after_dot) == 3 and len(before_dot) <= 3:
                    # "1.234" → thousands separator (1234)
                    num_str = num_str.replace(".", "")
                # else "29.99" → decimal (keep as is)
            elif commas >= 1 and dots >= 1:
                # Mixed separators: the LAST separator is the decimal
                last_dot = num_str.rfind(".")
                last_comma = num_str.rfind(",")
                if last_comma > last_dot:
                    # "1.234,56" → dots are thousands, comma is decimal
                    num_str = num_str.replace(".", "").replace(",", ".")
                else:
                    # "1,234.56" → commas are thousands, dot is decimal
                    num_str = num_str.replace(",", "")
            elif dots > 1:
                # "1.234.567" → dots are thousands separators
                num_str = num_str.replace(".", "")
            elif commas > 1:
                # "1,234,567" → commas are thousands separators
                num_str = num_str.replace(",", "")
            else:
                # Just digits, no separators
                num_str = num_str.replace(",", "").replace(".", "")

            try:
                val = float(num_str)
                return val if val > 0 else None
            except (ValueError, TypeError):
                continue

    return None


def _extract_stock_from_jsonld(offers: dict | list | None) -> int | None:
    """Extract stock quantity from JSON-LD offers data."""
    if not offers:
        return None
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if not isinstance(offers, dict):
        return None

    # Check availability
    availability = (offers.get("availability") or "").lower()
    if "outofstock" in availability or "discontinued" in availability:
        return 0
    if "instock" in availability or "preorder" in availability:
        # In stock but no exact quantity — return None (unknown)
        pass

    # Check inventoryLevel (Schema.org)
    inv_level = offers.get("inventoryLevel")
    if isinstance(inv_level, dict):
        val = inv_level.get("value")
        if val is not None:
            try:
                return int(val)
            except (ValueError, TypeError):
                pass
    if isinstance(inv_level, (int, float)):
        return int(inv_level)

    return None


def _extract_stock_from_html(soup: BeautifulSoup) -> int | None:
    """Extract stock/inventory info from HTML elements."""
    # Method 1: data attributes
    for attr in ("data-stock", "data-inventory", "data-quantity", "data-stock-quantity"):
        el = soup.find(attrs={attr: True})
        if el:
            try:
                return int(el[attr])
            except (ValueError, TypeError):
                pass

    # Method 2: Elements with stock-related classes
    stock_selectors = [
        "[class*='stock']", "[class*='Stock']", "[class*='inventory']",
        "[class*='Inventory']", "[class*='availability']",
        "[class*='disponib']",  # disponible/disponibilidad
        "[id*='stock']", "[id*='inventory']",
    ]
    for sel in stock_selectors:
        try:
            el = soup.select_one(sel)
        except Exception:
            continue
        if el:
            text = el.get_text(strip=True).lower()
            # "12 en stock", "Stock: 5", "Quedan 3 unidades"
            qty_match = re.search(r"(\d+)\s*(?:en stock|in stock|unidades|disponibles|available|left|quedan|items)", text, re.I)
            if qty_match:
                return int(qty_match.group(1))
            qty_match = re.search(r"(?:stock|inventario|inventory|qty|cantidad)[\s:]*(\d+)", text, re.I)
            if qty_match:
                return int(qty_match.group(1))
            # "agotado" / "out of stock" / "sin stock"
            if any(x in text for x in ("agotado", "out of stock", "sin stock", "no disponible", "unavailable")):
                return 0

    # Method 3: Input fields for quantity (max attribute)
    qty_input = soup.select_one("input[name='quantity'][max], input[name='qty'][max], input[type='number'][max]")
    if qty_input:
        max_val = qty_input.get("max")
        if max_val and max_val.isdigit():
            val = int(max_val)
            if 0 < val < 10000:  # Reasonable stock range
                return val

    # Method 4: JSON in script tags (common in Shopify, WooCommerce, etc.)
    for script in soup.find_all("script"):
        text = script.string or ""
        if not text or len(text) < 20:
            continue
        # Shopify: "inventory_quantity":5
        for pattern in [
            r'"inventory_quantity"\s*:\s*(\d+)',
            r'"stock_quantity"\s*:\s*(\d+)',
            r'"stock"\s*:\s*(\d+)',
            r'"qty"\s*:\s*(\d+)',
            r'"quantity"\s*:\s*(\d+)',
            r'"available_quantity"\s*:\s*(\d+)',
        ]:
            m = re.search(pattern, text)
            if m:
                try:
                    val = int(m.group(1))
                    if 0 <= val < 100000:
                        return val
                except (ValueError, TypeError):
                    pass

    return None


def _html_to_clean_text(element) -> str:
    """
    Convert an HTML element (or raw HTML string) to clean readable text,
    preserving paragraph breaks, list items, and basic structure.

    Unlike get_text(strip=True) which crushes everything into one line,
    this keeps logical spacing between paragraphs, headings, and list items.
    """
    if isinstance(element, str):
        # Raw HTML string — parse it first
        _parser = "lxml" if _has_lxml() else "html.parser"
        element = BeautifulSoup(element, _parser)

    if not element:
        return ""

    # Remove script, style, nav, footer elements
    for tag in element.find_all(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()

    # Insert line breaks before block-level elements
    block_tags = {
        "p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6",
        "li", "tr", "blockquote", "section", "article",
        "ul", "ol", "table", "thead", "tbody", "dt", "dd",
        "pre", "hr", "figcaption",
    }

    for tag in element.find_all(True):
        if tag.name in block_tags:
            # Insert a newline marker before the tag
            tag.insert_before("\n")
            # For list items, add a bullet
            if tag.name == "li":
                tag.insert_before("• ")
            # For headings, add emphasis
            if tag.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                tag.insert_after("\n")
        elif tag.name == "br":
            tag.replace_with("\n")

    # Get text
    text = element.get_text()

    # Clean up:
    # 1. Replace tabs with spaces
    text = text.replace("\t", " ")
    # 2. Collapse multiple spaces on the same line into one
    text = re.sub(r"[^\S\n]+", " ", text)
    # 3. Strip each line
    lines = [line.strip() for line in text.split("\n")]
    # 4. Remove empty consecutive lines (keep max 1 blank line)
    cleaned_lines: list[str] = []
    prev_empty = False
    for line in lines:
        if not line:
            if not prev_empty and cleaned_lines:
                cleaned_lines.append("")
            prev_empty = True
        else:
            cleaned_lines.append(line)
            prev_empty = False

    result = "\n".join(cleaned_lines).strip()
    return result


def _clean_description(raw_html: str | None, max_length: int = 2000) -> str | None:
    """Clean an HTML description string into readable text with structure."""
    if not raw_html:
        return None
    text = _html_to_clean_text(raw_html)
    if not text or len(text) < 5:
        return None
    # Validate: reject junk descriptions
    if _is_junk_description(text):
        return None
    return text[:max_length]


def _is_junk_description(text: str) -> bool:
    """
    Detect if extracted 'description' text is actually junk
    (navigation, menu items, breadcrumbs, cookie notices, etc.)
    """
    if not text:
        return True
    lower = text.lower().strip()

    # Too short to be a real description
    if len(lower) < 15:
        return True

    # Navigation/menu patterns: lots of short lines (menu items)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if len(lines) > 5:
        short_lines = sum(1 for l in lines if len(l) < 20)
        if short_lines > len(lines) * 0.7:
            # More than 70% of lines are very short → probably a menu/nav
            return True

    # Common junk patterns
    junk_phrases = [
        "agregar al carrito", "add to cart", "añadir al carrito",
        "comprar ahora", "buy now",
        "iniciar sesión", "log in", "sign in", "registrarse",
        "política de privacidad", "privacy policy",
        "términos y condiciones", "terms and conditions",
        "aceptar cookies", "accept cookies",
        "suscribirse", "subscribe", "newsletter",
        "todos los derechos reservados", "all rights reserved",
        "powered by", "copyright ©",
    ]
    # If the description contains multiple junk phrases, it's likely not a real description
    junk_count = sum(1 for jp in junk_phrases if jp in lower)
    if junk_count >= 2:
        return True

    # If text starts with navigation-like content
    nav_starts = [
        "inicio", "home", "menú", "menu", "categorías", "categories",
        "mi cuenta", "my account", "carrito", "cart",
    ]
    first_line = lines[0].lower() if lines else ""
    if any(first_line.startswith(ns) for ns in nav_starts):
        return True

    # Breadcrumb-like text (e.g. "Inicio > Teléfonos > iPhone")
    if text.count(" > ") >= 2 or text.count(" / ") >= 3 or text.count(" » ") >= 2:
        return True

    return False


def _is_junk_name(name: str) -> bool:
    """Filtrar nombres que claramente no son productos."""
    if not name or len(name) < 2:
        return True
    lower = name.lower().strip()
    junk = [
        "menu", "nav", "footer", "header", "sidebar", "search", "buscar",
        "iniciar sesión", "login", "registrar", "sign up", "carrito", "cart",
        "wishlist", "favoritos", "ver más", "see more", "load more",
        "siguiente", "anterior", "next", "prev", "cerrar", "close",
    ]
    return any(lower == j or lower.startswith(j + " ") for j in junk)


# ---------------------------------------------------------------------------
# 0. Currency detection from HTML
# ---------------------------------------------------------------------------

def _detect_currency_from_html(html: str, url: str) -> str | None:
    """
    Detect the site's currency from structured data in the HTML.
    Checks (in order):
    1. JSON-LD priceCurrency (most reliable — set by the e-commerce platform)
    2. <meta property="product:price:currency">
    3. <meta property="og:price:currency">
    """
    parser = "lxml" if _has_lxml() else "html.parser"
    soup = BeautifulSoup(html, parser)

    # 1. JSON-LD priceCurrency
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if isinstance(item, dict) and item.get("@graph"):
                    items.extend(item["@graph"])

            for item in items:
                if not isinstance(item, dict):
                    continue
                item_type = str(item.get("@type", ""))
                if "Product" not in item_type:
                    continue

                offers = item.get("offers")
                if isinstance(offers, dict):
                    currency = offers.get("priceCurrency")
                    if currency and isinstance(currency, str) and len(currency) == 3:
                        logger.info(f"Currency from JSON-LD priceCurrency: {currency.upper()}")
                        return currency.upper()
                elif isinstance(offers, list):
                    for off in offers:
                        currency = off.get("priceCurrency")
                        if currency and isinstance(currency, str) and len(currency) == 3:
                            logger.info(f"Currency from JSON-LD priceCurrency: {currency.upper()}")
                            return currency.upper()
        except (json.JSONDecodeError, TypeError):
            continue

    # 2. Meta tags
    for meta_prop in ("product:price:currency", "og:price:currency"):
        meta = soup.find("meta", property=meta_prop)
        if meta and meta.get("content"):
            currency = meta["content"].strip().upper()
            if len(currency) == 3:
                logger.info(f"Currency from meta {meta_prop}: {currency}")
                return currency

    return None


# 1. JSON-LD / structured data extraction
# ---------------------------------------------------------------------------

def _extract_jsonld_products(soup: BeautifulSoup, base_url: str) -> list[ScrapedProduct]:
    """Extract products from JSON-LD structured data."""
    products: list[ScrapedProduct] = []
    seen_names: set[str] = set()

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("@graph"):
                items.extend(item["@graph"])

        for item in items:
            if not isinstance(item, dict):
                continue
            item_type = item.get("@type", "")
            if isinstance(item_type, list):
                item_type = " ".join(item_type)
            if "Product" not in item_type:
                continue

            name = item.get("name", "").strip()
            if not name or name in seen_names:
                continue
            seen_names.add(name)

            images = []
            img = item.get("image")
            if isinstance(img, str):
                images = [_abs(base_url, img)] if img else []
            elif isinstance(img, list):
                images = [_abs(base_url, i) for i in img if isinstance(i, str)]
            elif isinstance(img, dict):
                images = [_abs(base_url, img.get("url"))] if img.get("url") else []
            images = [u for u in images if u]

            price = None
            compare = None
            stock = None
            offers = item.get("offers")
            if isinstance(offers, dict):
                offer_type = offers.get("@type", "")
                if "AggregateOffer" in str(offer_type):
                    # Variable product (e.g. WooCommerce with sizes/colors)
                    # Use lowPrice as the displayed price, highPrice as compare
                    price = _parse_price(offers.get("lowPrice")) or _parse_price(offers.get("price"))
                    high = _parse_price(offers.get("highPrice"))
                    if high and price and high > price:
                        compare = high
                else:
                    price = _parse_price(offers.get("price"))
                stock = _extract_stock_from_jsonld(offers)
            elif isinstance(offers, list) and offers:
                # Multiple individual offers — take lowest price
                prices = []
                for off in offers:
                    p = _parse_price(off.get("price"))
                    if p:
                        prices.append(p)
                if prices:
                    price = min(prices)
                    if len(prices) > 1:
                        compare = max(prices)
                        if compare == price:
                            compare = None
                stock = _extract_stock_from_jsonld(offers[0])

            products.append(ScrapedProduct(
                name=name,
                description=_clean_description(item.get("description"), 2000),
                price=price,
                compare_at_price=compare,
                image_urls=images[:8],
                sku=str(item["sku"]).strip()[:50] if item.get("sku") else None,
                stock_quantity=stock,
            ))

    return products


# ---------------------------------------------------------------------------
# 1b. Extruct structured data extraction (microdata, RDFa, OpenGraph, JSON-LD)
# ---------------------------------------------------------------------------

def _extract_extruct_products(html: str, base_url: str) -> list[ScrapedProduct]:
    """Use extruct to extract products from microdata, RDFa, and other formats."""
    products: list[ScrapedProduct] = []
    try:
        import extruct
        data = extruct.extract(html, base_url=base_url, errors="ignore",
                               syntaxes=["json-ld", "microdata", "rdfa", "opengraph"])

        # Microdata products
        for item in data.get("microdata", []):
            item_type = item.get("type", "")
            if isinstance(item_type, str) and "Product" in item_type:
                props = item.get("properties", {})
                name = props.get("name", "").strip()
                if not name:
                    continue
                images = []
                img = props.get("image")
                if isinstance(img, str):
                    images = [_abs(base_url, img)]
                elif isinstance(img, list):
                    images = [_abs(base_url, i) for i in img if isinstance(i, str)]
                images = [u for u in images if u]

                price = None
                compare = None
                offers = props.get("offers")
                if isinstance(offers, dict):
                    offer_props = offers.get("properties", {})
                    offer_type = offers.get("type", "")
                    if "AggregateOffer" in str(offer_type):
                        price = _parse_price(offer_props.get("lowPrice")) or _parse_price(offer_props.get("price"))
                        high = _parse_price(offer_props.get("highPrice"))
                        if high and price and high > price:
                            compare = high
                    else:
                        price = _parse_price(offer_props.get("price"))
                elif isinstance(offers, list) and offers:
                    price = _parse_price(offers[0].get("properties", {}).get("price"))

                products.append(ScrapedProduct(
                    name=name[:255],
                    description=_clean_description(props.get("description"), 2000),
                    price=price,
                    compare_at_price=compare,
                    image_urls=images[:8],
                    sku=str(props["sku"]).strip()[:50] if props.get("sku") else None,
                ))

        # OpenGraph as single product (only if og:type is product)
        og = data.get("opengraph", [])
        if og and not products:
            for og_item in og:
                og_props = og_item.get("properties", [])
                og_dict = {}
                for prop in og_props:
                    if isinstance(prop, (list, tuple)) and len(prop) >= 2:
                        og_dict[prop[0]] = prop[1]
                og_type = og_dict.get("og:type", "")
                og_title = og_dict.get("og:title", "").strip()
                if og_title and ("product" in og_type.lower() or og_dict.get("product:price:amount")):
                    images = [og_dict["og:image"]] if og_dict.get("og:image") else []
                    price = _parse_price(og_dict.get("product:price:amount"))
                    products.append(ScrapedProduct(
                        name=og_title[:255],
                        description=(og_dict.get("og:description") or "")[:500] or None,
                        price=price,
                        image_urls=images[:5],
                    ))
    except Exception as e:
        logger.warning(f"Extruct extraction failed: {e}")

    return products


# ---------------------------------------------------------------------------
# 2. HTML heuristic product extraction
# ---------------------------------------------------------------------------

PRODUCT_CARD_SELECTORS = [
    # Specific e-commerce selectors
    ".product-card", ".product-item", ".product",
    "[class*='ProductCard']", "[class*='product-card']", "[class*='product-item']",
    ".grid-product", ".collection-product",
    ".t-product", ".product-block", ".product-tile",
    "li.product", "div.product",
    # Tiendanube
    "[data-product-id]", ".js-item-product",
    # WooCommerce
    ".woocommerce-loop-product__link", "li.type-product",
    # Shopify
    ".product-grid-item", ".grid__item[class*='product']",
    # Generic catalog patterns
    ".item-product", ".producto", ".post.product",
    "[class*='catalogue']", "[class*='catalog']",
    # Owl Carousel / generic card patterns (Puma, etc.)
    ".product-info", ".card.product-info",
    ".owl-item .card", ".owl-item .product-info",
    # Generic card patterns used by many sites
    ".card[class*='product']", ".item[class*='product']",
    "[class*='product-card']", "[class*='productCard']",
    # Splide / Swiper carousel items
    ".splide__slide .card", ".swiper-slide .card",
    ".swiper-slide .product", ".splide__slide .product",
    # Other common patterns
    ".post", ".item", ".card",
]

PRICE_SELECTORS = [
    ".price", ".product-price", "[class*='price']",
    "[class*='Price']", ".money", "span.amount",
    "[data-price]", ".precio", "[class*='precio']",
    "[class*='Precio']",
]


def _extract_product_from_card(card: Tag, base_url: str, seen: set[str]) -> ScrapedProduct | None:
    """Extract a single product from a card element."""
    # Try multiple ways to find the product name
    name = ""
    for name_sel in [
        card.find(["h2", "h3", "h4", "h5", "h6"]),
        card.select_one("[class*='name'], [class*='title'], [class*='Name'], [class*='Title'], [class*='nombre']"),
        card.find("a", title=True),
        card.find("a"),
    ]:
        if name_sel:
            if hasattr(name_sel, "get") and name_sel.get("title"):
                name = name_sel["title"].strip()
            else:
                name = name_sel.get_text(strip=True)
            if name and len(name) > 2 and not _is_junk_name(name):
                break
            name = ""

    if not name or name in seen:
        return None

    # Find images
    img = card.find("img")
    images = []
    if img:
        src = (img.get("src") or img.get("data-src") or
               img.get("data-lazy-src") or img.get("data-original") or
               img.get("data-image"))
        if src:
            # Skip tiny tracking pixels and icons
            if any(skip in src.lower() for skip in (
                "pixel", "tracking", "spacer", "blank", "1x1",
                "logo", "icon", "favicon", "badge", "flag",
            )):
                src = None
        abs_src = _abs(base_url, src) if src else None
        if abs_src:
            images.append(abs_src)

    # Find price
    price = None
    for ps in PRICE_SELECTORS:
        try:
            price_el = card.select_one(ps)
        except Exception:
            continue
        if price_el:
            price = _parse_price(price_el.get_text(strip=True))
            if price:
                break

    # Try $ pattern as last resort for price
    if not price:
        card_text = card.get_text()
        price_match = re.search(r"\$\s*([\d.,]+)", card_text)
        if price_match:
            price = _parse_price(price_match.group(1))

    # Need at least a name + (image OR price) to be a real product
    if not images and not price:
        return None

    # Find product detail URL (link to individual product page)
    detail_url = None
    link_el = card.find("a", href=True)
    if link_el:
        href = link_el.get("href", "")
        if href and not href.startswith(("#", "javascript:")):
            detail_url = _abs(base_url, href)

    # Find compare/original price (strikethrough, sale, old price)
    compare = None
    for cp_sel in ["[class*='compare']", "[class*='original']", "[class*='was']",
                   "[class*='regular']", "[class*='old']", "[class*='antes']",
                   "[class*='tachado']", "[class*='list']", "del", "s"]:
        try:
            cp_el = card.select_one(cp_sel)
        except Exception:
            continue
        if cp_el:
            compare = _parse_price(cp_el.get_text(strip=True))
            if compare and compare != price:
                break
            compare = None

    # Find description from card (if available)
    description = None
    for desc_sel in card.find_all(["p", "span"]):
        text = _html_to_clean_text(desc_sel)
        # Skip short texts, prices, and navigation
        if text and len(text) > 20 and not text.startswith("$") and text != name:
            description = text[:500]
            break

    # Find SKU
    sku = None
    sku_el = card.select_one("[class*='sku'], [class*='cod'], [class*='code'], [data-sku]")
    if sku_el:
        sku_text = sku_el.get("data-sku") or sku_el.get_text(strip=True)
        if sku_text:
            sku = re.sub(r"^(cod\.?|código|sku):?\s*", "", sku_text, flags=re.I).strip()[:50]

    seen.add(name)
    return ScrapedProduct(
        name=name[:255],
        description=description,
        price=price,
        compare_at_price=compare,
        image_urls=images[:5],
        sku=sku,
        detail_url=detail_url,
    )


def _extract_html_products(soup: BeautifulSoup, base_url: str) -> list[ScrapedProduct]:
    """Extract products using common e-commerce CSS selectors.
    Tries ALL selectors and collects ALL unique products found."""
    products: list[ScrapedProduct] = []
    seen: set[str] = set()

    # Phase 1: Try specific e-commerce selectors first (higher confidence)
    specific_selectors = PRODUCT_CARD_SELECTORS[:-3]  # All except .post, .item, .card
    for selector in specific_selectors:
        try:
            cards = soup.select(selector)
        except Exception:
            continue
        if not cards:
            continue

        for card in cards[:MAX_SITEMAP_PRODUCTS]:
            product = _extract_product_from_card(card, base_url, seen)
            if product:
                products.append(product)

    # Phase 2: If we found fewer than 3 products, try generic selectors
    if len(products) < 3:
        generic_selectors = PRODUCT_CARD_SELECTORS[-3:]  # .post, .item, .card
        for selector in generic_selectors:
            try:
                cards = soup.select(selector)
            except Exception:
                continue
            if not cards or len(cards) < 3:
                continue  # Skip if too few — probably not a product grid

            for card in cards[:MAX_SITEMAP_PRODUCTS]:
                product = _extract_product_from_card(card, base_url, seen)
                if product:
                    products.append(product)

    return products


# ---------------------------------------------------------------------------
# 3. AJAX discovery — detect JS-loaded product endpoints and fetch them
# ---------------------------------------------------------------------------

# Patterns to find AJAX URLs in JavaScript code
AJAX_URL_PATTERNS = [
    # Generic AJAX/fetch/XHR patterns
    re.compile(r"""(?:url|endpoint|api_url|ajax_url|fetchUrl|baseUrl)\s*[:=]\s*['"]([^'"]+(?:ajax|api|product|catalog|catalogo)[^'"]*?)['"]""", re.I),
    # jQuery $.get/$.post/$.ajax
    re.compile(r"""\$\.(?:get|post|ajax)\s*\(\s*['"]([^'"]+)['"]""", re.I),
    # fetch() calls
    re.compile(r"""fetch\s*\(\s*['"]([^'"]+(?:product|catalog|catalogo|api)[^'"]*?)['"]""", re.I),
    # XMLHttpRequest
    re.compile(r"""\.open\s*\(\s*['"](?:GET|POST)['"],\s*['"]([^'"]+)['"]""", re.I),
    # Common catalog AJAX patterns
    re.compile(r"""['"](/ajax/[^'"]+)['"]""", re.I),
    re.compile(r"""['"](/api/[^'"]*product[^'"]*?)['"]""", re.I),
    re.compile(r"""['"](/wp-json/[^'"]+product[^'"]*?)['"]""", re.I),
]


def _discover_ajax_endpoints(soup: BeautifulSoup, page_url: str) -> list[str]:
    """Scan all <script> tags for AJAX endpoints that might load products."""
    parsed = urlparse(page_url)
    base_origin = f"{parsed.scheme}://{parsed.netloc}"
    path_parts = [p for p in parsed.path.strip("/").split("/") if p]
    endpoints: list[str] = []
    seen: set[str] = set()

    for script in soup.find_all("script"):
        js_code = script.string or ""
        if not js_code or len(js_code) < 20:
            continue

        for pattern in AJAX_URL_PATTERNS:
            for match in pattern.finditer(js_code):
                url_fragment = match.group(1)
                if url_fragment in seen:
                    continue
                seen.add(url_fragment)

                # Build absolute URL
                if url_fragment.startswith("http"):
                    # Only same-origin URLs
                    frag_parsed = urlparse(url_fragment)
                    if frag_parsed.netloc and frag_parsed.netloc != parsed.netloc:
                        continue
                    abs_url = url_fragment
                elif url_fragment.startswith("/"):
                    abs_url = base_origin + url_fragment
                else:
                    abs_url = base_origin + "/" + url_fragment

                endpoints.append(abs_url)

    # Also try common AJAX patterns based on the page URL structure
    # e.g., /modalidad/CABALLEROS/WALKING -> try /ajax/catalogo/page/1.html?params
    common_ajax_paths = [
        "/ajax/catalogo/page/1.html",
        "/ajax/products/page/1.html",
        "/api/products",
        "/api/catalog",
    ]

    # Build query params from URL path
    query_params = {}
    if len(path_parts) >= 2:
        # Common patterns: /category/subcategory, /modalidad/X/Y, /genero/X
        for i in range(0, len(path_parts) - 1, 2):
            key = path_parts[i].lower()
            if i + 1 < len(path_parts):
                query_params[key] = path_parts[i + 1]
        # Also add original query string params
        original_qs = parse_qs(parsed.query)
        for k, v in original_qs.items():
            query_params[k] = v[0] if v else ""

    for ajax_path in common_ajax_paths:
        base_ajax = base_origin + ajax_path
        if query_params:
            base_ajax += "?" + urlencode(query_params)
        if base_ajax not in seen:
            seen.add(base_ajax)
            endpoints.append(base_ajax)

    return endpoints[:10]  # Limit to 10 attempts


def _fetch_ajax_products(client: httpx.Client, endpoints: list[str], page_url: str) -> list[ScrapedProduct]:
    """Try fetching product data from discovered AJAX endpoints."""
    parsed = urlparse(page_url)
    referer = page_url

    for endpoint in endpoints:
        try:
            resp = client.get(
                endpoint,
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "text/html, application/json, */*",
                    "Referer": referer,
                },
                timeout=10,
            )
            if resp.status_code != 200:
                continue

            content_type = resp.headers.get("content-type", "")
            body = resp.text.strip()
            if not body:
                continue

            products: list[ScrapedProduct] = []

            # Try JSON response
            if "json" in content_type or body.startswith(("{", "[")):
                try:
                    data = json.loads(body)
                    products = _parse_json_products(data, endpoint)
                    if products:
                        logger.info(f"Found {len(products)} products from AJAX JSON: {endpoint}")
                        return products
                except json.JSONDecodeError:
                    pass

            # Try HTML response (many sites return HTML fragments via AJAX)
            if "html" in content_type or body.startswith("<"):
                parser = "lxml" if _has_lxml() else "html.parser"
                ajax_soup = BeautifulSoup(body, parser)

                # First try structured data in AJAX response
                products = _extract_jsonld_products(ajax_soup, endpoint)
                if products:
                    logger.info(f"Found {len(products)} products from AJAX JSON-LD: {endpoint}")
                    return products

                # Try HTML card selectors
                products = _extract_html_products(ajax_soup, endpoint)
                if products:
                    logger.info(f"Found {len(products)} products from AJAX HTML selectors: {endpoint}")
                    return products

                # Try generic grid detection on AJAX HTML
                products = _extract_generic_grid(ajax_soup, endpoint)
                if products:
                    logger.info(f"Found {len(products)} products from AJAX generic grid: {endpoint}")
                    return products

        except Exception as e:
            logger.debug(f"AJAX endpoint {endpoint} failed: {e}")
            continue

    return []


def _parse_json_products(data: dict | list, base_url: str) -> list[ScrapedProduct]:
    """Parse product data from a JSON API response."""
    products: list[ScrapedProduct] = []
    seen: set[str] = set()

    # Normalize to list
    items: list[dict] = []
    if isinstance(data, list):
        items = [i for i in data if isinstance(i, dict)]
    elif isinstance(data, dict):
        # Look for common JSON response structures
        for key in ("products", "items", "results", "data", "productos",
                     "records", "hits", "docs", "nodes", "edges"):
            val = data.get(key)
            if isinstance(val, list):
                items = [i for i in val if isinstance(i, dict)]
                break
        if not items and "name" in data and ("price" in data or "image" in data):
            items = [data]

    for item in items[:MAX_SITEMAP_PRODUCTS]:
        # Extract name
        name = ""
        for name_key in ("name", "title", "product_name", "nombre", "titulo"):
            name = str(item.get(name_key, "")).strip()
            if name:
                break
        if not name or name in seen:
            continue
        seen.add(name)

        # Extract price
        price = None
        for price_key in ("price", "precio", "sale_price", "current_price",
                          "price_amount", "unit_price"):
            raw_price = item.get(price_key)
            if raw_price is not None:
                if isinstance(raw_price, (int, float)):
                    price = float(raw_price) if raw_price > 0 else None
                else:
                    price = _parse_price(str(raw_price))
                if price:
                    break

        # Extract compare price
        compare = None
        for cp_key in ("compare_at_price", "original_price", "regular_price",
                        "list_price", "precio_lista"):
            raw_cp = item.get(cp_key)
            if raw_cp is not None:
                if isinstance(raw_cp, (int, float)):
                    compare = float(raw_cp) if raw_cp > 0 else None
                else:
                    compare = _parse_price(str(raw_cp))
                if compare:
                    break

        # Extract images
        images: list[str] = []
        for img_key in ("image", "images", "image_url", "thumbnail", "imagen",
                         "featured_image", "img", "photo", "picture"):
            img_val = item.get(img_key)
            if isinstance(img_val, str) and img_val:
                abs_img = _abs(base_url, img_val)
                if abs_img:
                    images.append(abs_img)
            elif isinstance(img_val, list):
                for iv in img_val[:5]:
                    if isinstance(iv, str):
                        abs_img = _abs(base_url, iv)
                    elif isinstance(iv, dict):
                        abs_img = _abs(base_url, iv.get("src") or iv.get("url") or "")
                    else:
                        abs_img = None
                    if abs_img:
                        images.append(abs_img)
            elif isinstance(img_val, dict):
                abs_img = _abs(base_url, img_val.get("src") or img_val.get("url") or "")
                if abs_img:
                    images.append(abs_img)
            if images:
                break

        # Extract SKU
        sku = None
        for sku_key in ("sku", "code", "cod", "codigo", "product_code",
                         "reference", "ref"):
            raw_sku = item.get(sku_key)
            if raw_sku:
                sku = str(raw_sku).strip()[:50]
                break

        # Extract description
        desc = None
        for desc_key in ("description", "descripcion", "short_description",
                          "body_html", "summary"):
            raw_desc = item.get(desc_key)
            if raw_desc and isinstance(raw_desc, str):
                desc = _clean_description(raw_desc, 500)
                if desc:
                    break

        products.append(ScrapedProduct(
            name=name[:255],
            description=desc,
            price=price,
            compare_at_price=compare,
            image_urls=images[:5],
            sku=sku,
        ))

    return products


# ---------------------------------------------------------------------------
# 4. Generic grid detection — find repeated elements with image+text+price
# ---------------------------------------------------------------------------

def _extract_generic_grid(soup: BeautifulSoup, base_url: str) -> list[ScrapedProduct]:
    """
    Detect product grids by finding repeated sibling elements that each contain
    an image, a text element, and optionally a price. This is the most generic
    approach for sites that don't use standard e-commerce class names.
    """
    products: list[ScrapedProduct] = []
    best_group: list[ScrapedProduct] = []

    # Look for containers that have 3+ similar children
    # Common patterns: ul>li, div>div, div>a, etc.
    containers = soup.find_all(["ul", "ol", "div", "section", "main"])

    for container in containers:
        if not isinstance(container, Tag):
            continue

        # Get direct children that are elements (not text nodes)
        children = [c for c in container.children if isinstance(c, Tag)]
        if len(children) < 3:
            continue

        # Check if children share the same tag + similar class pattern
        tag_class_groups: dict[str, list[Tag]] = {}
        for child in children:
            tag = child.name
            classes = sorted(child.get("class", []))
            key = f"{tag}:{'.'.join(classes)}" if classes else tag
            tag_class_groups.setdefault(key, []).append(child)

        # Find the largest group of similar children
        for group_key, group in tag_class_groups.items():
            if len(group) < 3:
                continue

            # Check if each child has an image AND text — that's likely a card
            candidates: list[ScrapedProduct] = []
            seen_names: set[str] = set()

            for card in group[:MAX_SITEMAP_PRODUCTS]:
                img = card.find("img")
                if not img:
                    continue

                # Get image src
                src = (img.get("src") or img.get("data-src") or
                       img.get("data-lazy-src") or img.get("data-original") or "")
                abs_src = _abs(base_url, src)
                if not abs_src:
                    continue

                # Skip tiny images
                width = img.get("width")
                if width and width.isdigit() and int(width) < 50:
                    continue
                if any(skip in src.lower() for skip in (
                    "logo", "icon", "favicon", "pixel", "tracking",
                    "badge", "flag", "svg", "spinner", "loading"
                )):
                    continue

                # Find text — product name
                name = ""
                # Try headings first
                for heading in card.find_all(["h2", "h3", "h4", "h5", "h6"]):
                    name = heading.get_text(strip=True)
                    if name and len(name) > 2 and not _is_junk_name(name):
                        break
                    name = ""

                # Try links with title attribute
                if not name:
                    link = card.find("a", title=True)
                    if link and link["title"].strip():
                        name = link["title"].strip()

                # Try text inside links
                if not name:
                    for link in card.find_all("a"):
                        text = link.get_text(strip=True)
                        # Skip very short text (like "$81") or navigation
                        if text and len(text) > 3 and not _is_junk_name(text) and not text.startswith("$"):
                            name = text
                            break

                # Try span/p/div with specific classes
                if not name:
                    for sel in card.select("[class*='name'], [class*='title'], [class*='Name'], [class*='Title'], [class*='nombre']"):
                        text = sel.get_text(strip=True)
                        if text and len(text) > 2:
                            name = text
                            break

                if not name or name in seen_names or _is_junk_name(name):
                    continue
                seen_names.add(name)

                # Find price
                price = None
                # Try elements with price-related classes
                for price_sel in [
                    "[class*='price']", "[class*='Price']", "[class*='precio']",
                    "[data-price]", ".money", ".amount",
                ]:
                    try:
                        price_el = card.select_one(price_sel)
                    except Exception:
                        continue
                    if price_el:
                        price = _parse_price(price_el.get_text(strip=True))
                        if price:
                            break

                # Try to find price by $ pattern in text
                if not price:
                    card_text = card.get_text()
                    price_match = re.search(r"\$\s*([\d.,]+)", card_text)
                    if price_match:
                        price = _parse_price(price_match.group(1))

                # Find compare/original price (strikethrough, sale, etc.)
                compare = None
                for cp_sel in ["[class*='compare']", "[class*='original']", "[class*='was']",
                               "[class*='regular']", "[class*='old']", "del", "s"]:
                    try:
                        cp_el = card.select_one(cp_sel)
                    except Exception:
                        continue
                    if cp_el:
                        compare = _parse_price(cp_el.get_text(strip=True))
                        if compare:
                            break

                # Find SKU/code
                sku = None
                sku_el = card.select_one("[class*='sku'], [class*='cod'], [class*='code'], [class*='ref']")
                if sku_el:
                    sku_text = sku_el.get_text(strip=True)
                    sku = re.sub(r"^(cod\.?|código|code|sku|ref\.?):?\s*", "", sku_text, flags=re.I).strip()[:50]
                # Also check data attributes
                if not sku:
                    for attr in ("data-sku", "data-product-id", "data-id", "data-code"):
                        attr_val = card.get(attr)
                        if attr_val:
                            sku = str(attr_val).strip()[:50]
                            break

                candidates.append(ScrapedProduct(
                    name=name[:255],
                    price=price,
                    compare_at_price=compare,
                    image_urls=[abs_src],
                    sku=sku,
                ))

            # Keep the best group (most candidates)
            if len(candidates) > len(best_group):
                best_group = candidates

    return best_group


# ---------------------------------------------------------------------------
# 5. OpenGraph as single product (only for product detail pages)
# ---------------------------------------------------------------------------

def _extract_og_product(soup: BeautifulSoup, base_url: str) -> list[ScrapedProduct]:
    """Extract a single product from OpenGraph meta tags.
    Only use this for actual product pages, not catalog pages."""
    og_type = soup.find("meta", property="og:type")
    og_title = soup.find("meta", property="og:title")
    og_price = soup.find("meta", property="product:price:amount") or soup.find("meta", property="og:price:amount")

    # Only use OG if it looks like a product page (has price meta or product type)
    if not og_price and not (og_type and og_type.get("content", "").lower() in ("product", "og:product")):
        return []

    if not og_title or not og_title.get("content"):
        return []

    name = og_title["content"].strip()
    if not name:
        return []

    og_desc = soup.find("meta", property="og:description")
    og_image = soup.find("meta", property="og:image")

    images = []
    if og_image and og_image.get("content"):
        img_url = _abs(base_url, og_image["content"])
        if img_url:
            images.append(img_url)

    price = _parse_price(og_price.get("content") if og_price else None)

    if not price:
        for el in soup.select("[class*='price'], [class*='Price'], [id*='price'], [data-price]")[:5]:
            price = _parse_price(el.get_text(strip=True))
            if price:
                break

    return [ScrapedProduct(
        name=name[:255],
        description=(og_desc["content"][:500] if og_desc and og_desc.get("content") else None),
        price=price,
        image_urls=images[:5],
    )]


# ---------------------------------------------------------------------------
# 6. Design extraction
# ---------------------------------------------------------------------------

HEX_RE = re.compile(r"#([0-9a-fA-F]{3,8})\b")
RGB_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")
CSS_VAR_COLOR_RE = re.compile(r"--([\w-]*(?:primary|main|brand|accent|bg|background|text|color)[\w-]*):\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))", re.I)
GOOGLE_FONTS_RE = re.compile(r"fonts\.googleapis\.com/css2?\?family=([^&\"']+)")


def _rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def _is_neutral(hex_color: str) -> bool:
    """Check if a color is very close to pure white, black, or gray."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) < 6:
        return True
    r, g, b = int(h[:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    spread = max(r, g, b) - min(r, g, b)
    return spread < 20


def _extract_design(soup: BeautifulSoup, base_url: str, css_texts: list[str]) -> ScrapedDesign:
    design = ScrapedDesign()

    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        design.logo_url = _abs(base_url, og_image["content"])

    favicon = soup.find("link", rel=lambda x: x and "icon" in (x if isinstance(x, str) else " ".join(x)))
    if favicon and favicon.get("href"):
        design.favicon_url = _abs(base_url, favicon["href"])

    for link in soup.find_all("link", href=True):
        match = GOOGLE_FONTS_RE.search(link["href"])
        if match:
            families = match.group(1).replace("+", " ").split("|")
            clean = [f.split(":")[0].strip() for f in families]
            if clean:
                design.font_heading = clean[0]
                design.font_body = clean[1] if len(clean) > 1 else clean[0]
            break

    all_css = "\n".join(css_texts)
    for style in soup.find_all("style"):
        all_css += "\n" + (style.string or "")

    css_var_colors: dict[str, str] = {}
    for match in CSS_VAR_COLOR_RE.finditer(all_css):
        var_name = match.group(1).lower()
        color_val = match.group(2)
        if color_val.startswith("rgb"):
            rgb_m = RGB_RE.match(color_val)
            if rgb_m:
                color_val = _rgb_to_hex(int(rgb_m.group(1)), int(rgb_m.group(2)), int(rgb_m.group(3)))
        css_var_colors[var_name] = color_val

    for var_name, color in css_var_colors.items():
        if any(k in var_name for k in ("primary", "brand", "main", "accent")) and not design.primary_color:
            if not _is_neutral(color):
                design.primary_color = color
        elif "background" in var_name or "bg" in var_name:
            if not design.background_color:
                design.background_color = color
        elif "text" in var_name:
            if not design.text_color:
                design.text_color = color

    if not design.primary_color:
        btn_colors: list[str] = []
        for btn in soup.select("button, .btn, [class*='button'], a.cta, [class*='Button']")[:10]:
            style = btn.get("style", "")
            for m in HEX_RE.finditer(style):
                c = "#" + m.group(1)
                if not _is_neutral(c):
                    btn_colors.append(c)
        if btn_colors:
            design.primary_color = btn_colors[0]

    if not design.primary_color:
        all_colors: list[str] = []
        for m in HEX_RE.finditer(all_css):
            c = "#" + m.group(1)
            if len(c) in (4, 7) and not _is_neutral(c):
                all_colors.append(c)
        if all_colors:
            from collections import Counter
            most_common = Counter(all_colors).most_common(3)
            design.primary_color = most_common[0][0]
            if len(most_common) > 1:
                design.secondary_color = most_common[1][0]

    return design


# ---------------------------------------------------------------------------
# 7. Section detection
# ---------------------------------------------------------------------------

SLIDER_CLASSES = ["swiper", "slick", "carousel", "slider", "slideshow", "banner-rotator", "hero-slider"]
HERO_CLASSES = ["hero", "banner", "jumbotron", "masthead", "cover", "main-banner"]


def _extract_sections(soup: BeautifulSoup, base_url: str) -> list[ScrapedSection]:
    sections: list[ScrapedSection] = []
    detected_types: set[str] = set()

    for el in soup.select("section, [class*='hero'], [class*='banner'], [class*='Hero'], [class*='Banner']")[:5]:
        classes = " ".join(el.get("class", [])).lower()
        if any(h in classes for h in HERO_CLASSES):
            if "hero" in detected_types:
                continue
            detected_types.add("hero")
            texts = []
            for heading in el.find_all(["h1", "h2"])[:2]:
                t = heading.get_text(strip=True)
                if t and len(t) > 2:
                    texts.append(t[:200])
            for p in el.find_all("p")[:1]:
                t = p.get_text(strip=True)
                if t and len(t) > 5:
                    texts.append(t[:300])
            images = []
            bg_img = el.find("img")
            if bg_img:
                src = _abs(base_url, bg_img.get("src") or bg_img.get("data-src"))
                if src:
                    images.append(src)
            style = el.get("style", "")
            bg_match = re.search(r"url\(['\"]?([^'\")\s]+)['\"]?\)", style)
            if bg_match:
                src = _abs(base_url, bg_match.group(1))
                if src:
                    images.append(src)

            sections.append(ScrapedSection(type="hero", images=images[:3], texts=texts))

    for el in soup.find_all(True, class_=lambda c: c and any(s in " ".join(c).lower() for s in SLIDER_CLASSES)):
        if "image_slider" in detected_types:
            break
        detected_types.add("image_slider")
        images = []
        for img in el.find_all("img")[:10]:
            src = _abs(base_url, img.get("src") or img.get("data-src") or img.get("data-lazy-src"))
            if src:
                images.append(src)
        if images:
            sections.append(ScrapedSection(type="image_slider", images=images))

    product_grids = soup.select(".products, .product-grid, .product-list, [class*='ProductGrid'], [class*='collection-products']")
    if product_grids and "featured_products" not in detected_types:
        detected_types.add("featured_products")
        sections.append(ScrapedSection(type="featured_products"))

    newsletter_forms = soup.select("form[class*='newsletter'], form[class*='subscribe'], form[class*='Newsletter']")
    if not newsletter_forms:
        email_inputs = soup.select("input[type='email']")
        for inp in email_inputs:
            form = inp.find_parent("form")
            if form:
                newsletter_forms.append(form)
                break

    if newsletter_forms and "newsletter" not in detected_types:
        detected_types.add("newsletter")
        texts = []
        for form in newsletter_forms[:1]:
            heading = form.find_previous(["h2", "h3", "h4"])
            if heading:
                t = heading.get_text(strip=True)
                if t:
                    texts.append(t[:200])
        sections.append(ScrapedSection(type="newsletter", texts=texts))

    return sections


# ---------------------------------------------------------------------------
# 8. Sitemap discovery
# ---------------------------------------------------------------------------

def _discover_product_urls(client: httpx.Client, base_url: str) -> list[str]:
    """Try to find product URLs from sitemap.xml."""
    urls: list[str] = []
    parsed = urlparse(base_url)
    sitemap_url = f"{parsed.scheme}://{parsed.netloc}/sitemap.xml"

    try:
        resp = client.get(sitemap_url, timeout=10)
        if resp.status_code != 200:
            return []
        xml_parser = "lxml-xml" if _has_lxml() else "html.parser"
        sitemap_soup = BeautifulSoup(resp.text, xml_parser)

        for loc in sitemap_soup.find_all("loc"):
            url = loc.get_text(strip=True)
            if any(kw in url.lower() for kw in ("/product", "/producto", "/products/", "/tienda/", "/shop/")):
                urls.append(url)
                if len(urls) >= MAX_SITEMAP_PRODUCTS:
                    break
    except Exception:
        pass

    return urls


def _extract_html_description(soup: BeautifulSoup) -> str | None:
    """
    Extract the product description from HTML containers.
    Every e-commerce platform puts the description in a known container:
    - WooCommerce: .woocommerce-product-details__short-description, #tab-description
    - Shopify: .product__description, .product-single__description
    - Tiendanube: .product-description
    - VTEX: .vtex-store-components-3-x-productDescriptionText
    - Generic: [itemprop='description'], [class*='description']
    Returns the LONGEST valid description found.
    """
    best_desc = None
    best_len = 0

    # Order matters: most specific first, then generic
    desc_selectors = [
        # WooCommerce (very common in LATAM stores)
        ".woocommerce-product-details__short-description",
        ".woocommerce-Tabs-panel--description",
        "#tab-description",
        "#tab-description .panel",

        # Shopify
        ".product__description",
        ".product-single__description",
        ".product-description",

        # Tiendanube / Nuvemshop
        "[data-component='product.description']",
        ".product-description",
        ".js-product-description",

        # VTEX
        "[class*='productDescriptionText']",
        "[class*='productDescription']",

        # PrestaShop
        "#product-description",
        ".product-description",

        # Magento
        "[class*='product-info-main'] [class*='description']",
        ".product.attribute.description .value",

        # Schema.org microdata (universal)
        "[itemprop='description']",

        # Generic patterns — wide coverage
        "[class*='product-body']", "[class*='product-content']",
        "[class*='product-text']", "[class*='product-info__description']",
        "[class*='ProductDescription']", "[class*='pdp-description']",
        "[class*='pdp-details']", "[class*='pdp-info']",
        "[data-testid*='description']", "[data-testid*='product-info']",
        "[data-testid*='product-description']",

        # ID-based
        "[id*='description']", "[id*='detalle']", "[id*='product-description']",

        # Class contains description/detail
        "[class*='description']", "[class*='Description']",
        "[class*='detalle']",

        # Less specific but still useful
        "[class*='overview']", "[class*='Overview']",
        "[class*='specs']", "[class*='specifications']",
        "[class*='features']", "[class*='Features']",

        # CMS / blog-based stores
        "article .entry-content",

        # Apple-style
        "[class*='rf-pdp']",

        # Summary area (many themes)
        ".entry-summary .description",
        ".summary .description",
    ]

    for desc_sel in desc_selectors:
        try:
            desc_el = soup.select_one(desc_sel)
        except Exception:
            continue
        if not desc_el:
            continue

        text = _html_to_clean_text(desc_el)
        if not text or len(text) < 20:
            continue
        if _is_junk_description(text):
            continue

        # Keep the longest valid description found
        if len(text) > best_len:
            best_desc = text[:2000]
            best_len = len(text)

    # Fallback to meta descriptions if nothing found
    if not best_desc or best_len < 50:
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            meta_text = og_desc["content"].strip()
            if len(meta_text) > best_len and not _is_junk_description(meta_text):
                best_desc = meta_text[:2000]
                best_len = len(meta_text)

        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            meta_text = meta_desc["content"].strip()
            if len(meta_text) > best_len and not _is_junk_description(meta_text):
                best_desc = meta_text[:2000]
                best_len = len(meta_text)

    return best_desc


def _scrape_product_detail(client: httpx.Client, url: str) -> ScrapedProduct | None:
    """
    Scrape a single product DETAIL page thoroughly.
    Extracts: name, full description, all images, price, compare price, SKU.
    Used both for sitemap discovery and for enriching catalog-scraped products.
    """
    try:
        resp = client.get(url, timeout=12)
        if resp.status_code != 200:
            return None
        parser = "lxml" if _has_lxml() else "html.parser"
        soup = BeautifulSoup(resp.text, parser)

        # ── Try JSON-LD first (most complete) ──
        products = _extract_jsonld_products(soup, url)
        if products:
            product = products[0]
            # ALWAYS extract gallery images from the HTML page and merge
            # JSON-LD often only has 1-2 images; the HTML gallery has the full set
            page_images = _extract_detail_images(soup, url)
            if page_images:
                # If HTML gallery found MORE images, prefer it as the primary source
                if len(page_images) > len(product.image_urls):
                    # Keep JSON-LD images that HTML didn't find, but HTML goes first
                    seen = set(page_images)
                    merged = list(page_images)
                    for img in product.image_urls:
                        if img not in seen:
                            merged.append(img)
                            seen.add(img)
                    product.image_urls = merged[:10]
                else:
                    # JSON-LD had more — add any new HTML ones
                    seen = set(product.image_urls)
                    for img in page_images:
                        if img not in seen:
                            product.image_urls.append(img)
                            seen.add(img)
                    product.image_urls = product.image_urls[:10]

            product.detail_url = url

            # ALWAYS try to get description from HTML containers
            # HTML has the REAL formatted description; JSON-LD often has a truncated/empty one
            html_description = _extract_html_description(soup)
            if html_description:
                # Prefer the LONGER description (HTML is usually better)
                if not product.description or len(html_description) > len(product.description):
                    product.description = html_description
            # Extract stock if not already set by JSON-LD
            if product.stock_quantity is None:
                product.stock_quantity = _extract_stock_from_html(soup)
            return product

        # ── Extruct ──
        try:
            import extruct
            data = extruct.extract(resp.text, base_url=url, errors="ignore",
                                   syntaxes=["microdata"])
            for item in data.get("microdata", []):
                item_type = item.get("type", "")
                if isinstance(item_type, str) and "Product" in item_type:
                    props = item.get("properties", {})
                    name = props.get("name", "").strip()
                    if name:
                        images = []
                        img = props.get("image")
                        if isinstance(img, str):
                            images = [_abs(url, img)]
                        elif isinstance(img, list):
                            images = [_abs(url, i) for i in img if isinstance(i, str)]
                        images = [u for u in images if u]

                        price = None
                        offers = props.get("offers")
                        if isinstance(offers, dict):
                            price = _parse_price(offers.get("properties", {}).get("price"))
                        elif isinstance(offers, list) and offers:
                            price = _parse_price(offers[0].get("properties", {}).get("price"))

                        # Enrich with page images
                        if len(images) < 3:
                            page_images = _extract_detail_images(soup, url)
                            seen = set(images)
                            for pi in page_images:
                                if pi not in seen:
                                    images.append(pi)
                                    seen.add(pi)
                                    if len(images) >= 8:
                                        break

                        return ScrapedProduct(
                            name=name[:255],
                            description=_clean_description(props.get("description"), 2000),
                            price=price,
                            image_urls=images[:8],
                            sku=str(props["sku"]).strip()[:50] if props.get("sku") else None,
                            detail_url=url,
                        )
        except Exception:
            pass

        # ── Manual HTML extraction from detail page ──
        # Name: h1 is almost always the product name on detail pages
        name = None
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(strip=True)[:255]
        if not name:
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                name = og_title["content"].strip()[:255]
        if not name:
            return None

        # Description: use centralized extraction function
        description = _extract_html_description(soup)

        # Images: collect all product images
        images = _extract_detail_images(soup, url)

        # Price
        price = None
        og_price = soup.find("meta", property="product:price:amount")
        if og_price and og_price.get("content"):
            price = _parse_price(og_price["content"])
        if not price:
            for ps in PRICE_SELECTORS:
                try:
                    price_el = soup.select_one(ps)
                except Exception:
                    continue
                if price_el:
                    price = _parse_price(price_el.get_text(strip=True))
                    if price:
                        break

        # Compare price
        compare = None
        for cp_sel in ["[class*='compare']", "[class*='original']", "[class*='was']",
                       "[class*='regular']", "[class*='old']", "[class*='antes']",
                       "[class*='tachado']", "[class*='list']", "del", "s"]:
            try:
                cp_el = soup.select_one(cp_sel)
            except Exception:
                continue
            if cp_el:
                compare = _parse_price(cp_el.get_text(strip=True))
                if compare and compare != price:
                    break
                compare = None

        # SKU
        sku = None
        for sku_sel in ["[class*='sku']", "[class*='cod']", "[class*='code']",
                        "[class*='ref']", "[data-sku]", "[itemprop='sku']"]:
            try:
                sku_el = soup.select_one(sku_sel)
            except Exception:
                continue
            if sku_el:
                sku_text = sku_el.get("data-sku") or sku_el.get("content") or sku_el.get_text(strip=True)
                if sku_text:
                    sku = re.sub(r"^(cod\.?|código|code|sku|ref\.?):?\s*", "", sku_text, flags=re.I).strip()[:50]
                    if sku:
                        break

        # Stock
        stock = _extract_stock_from_html(soup)

        return ScrapedProduct(
            name=name,
            description=description,
            price=price,
            compare_at_price=compare,
            image_urls=images[:8],
            sku=sku,
            stock_quantity=stock,
            detail_url=url,
        )

    except Exception as e:
        logger.debug(f"Failed to scrape product detail {url}: {e}")
        return None


def _is_inside_excluded_section(element: Tag) -> bool:
    """
    UNIVERSAL check: is this element inside a section that contains OTHER products
    (related, recommended, recently viewed, etc.) — NOT the main product gallery.
    Works across all e-commerce platforms and languages.
    """
    el = element.parent
    for _ in range(12):  # Check up to 12 levels for deeply nested DOMs
        if not el or not isinstance(el, Tag):
            break

        classes = " ".join(el.get("class", [])).lower()
        el_id = (el.get("id") or "").lower()
        el_role = (el.get("role") or "").lower()
        el_data = " ".join(
            str(v).lower() for k, v in el.attrs.items()
            if k.startswith("data-") and isinstance(v, str)
        )
        combined = f"{classes} {el_id} {el_role} {el_data}"

        # ── Exclude keywords — multi-language (ES, EN, PT, FR, DE) ──
        exclude_keywords = [
            # Related / recommended
            "relacionado", "related", "recommend", "recomendado",
            "sugerido", "suggested", "sugestao", "sugerencia",
            "similar", "parecido",
            # "Also like" / "You may"
            "tambien", "also-like", "also_like", "alsolike",
            "you-may", "you_may", "youmay", "might-like", "might_like",
            "te-puede", "te_puede", "puede-gustar", "podria-gustar",
            # Recently viewed
            "recently", "reciente", "visto-reciente", "viewed",
            # Upsell / cross-sell
            "upsell", "cross-sell", "crosssell", "up-sell",
            # Complete the look
            "complementar", "complement", "complete-the-look", "complete-look",
            "combina-con", "combine-with",
            # Other product sections
            "other-product", "otros-producto", "more-product",
            "mas-producto", "mais-produto",
            # Trending / best sellers / new arrivals
            "best-seller", "bestseller", "trending", "mas-vendido",
            "new-arrival", "novedades", "novedad", "lancamento",
            # Generic product listing widgets
            "slot-product", "product-carousel", "product-slider",
            "product-list", "product-grid", "product-card-group",
            "products-grid", "collection-list",
            # Shopify specific
            "shopify-section-related", "shopify-section-recommend",
            "complementary-products",
            # WooCommerce specific
            "woocommerce-product-related",
            # Magento specific
            "catalog-product-related", "block-related",
            # VTEX specific
            "vtex-shelf", "shelf-container",
            # Social proof / marketing
            "social-proof", "socialproof", "trust-badge", "review-carousel",
        ]

        if any(kw in combined for kw in exclude_keywords):
            return True

        # ── Check heading text inside this container ──
        # If an h2/h3/h4 says "Related Products" etc., exclude everything below it
        heading_keywords = [
            "relacionado", "related", "recommend", "recomendado",
            "también te", "also like", "you may", "you might",
            "similar", "completá", "complete", "otros producto",
            "más producto", "visto reciente", "recently viewed",
            "quizás te", "tal vez te", "podría gustarte",
        ]
        for htag in el.find_all(["h2", "h3", "h4"], recursive=False):
            heading_text = htag.get_text(strip=True).lower()
            if any(hk in heading_text for hk in heading_keywords):
                return True

        # ── Exclude structural areas ──
        if el.name in ("footer", "nav", "aside", "header"):
            return True
        if any(kw in combined for kw in (
            "footer", "site-footer", "page-footer",
            "nav-", "navbar", "navigation", "menu",
            "header", "site-header", "page-header",
            "sidebar", "side-bar",
        )):
            return True

        el = el.parent

    return False


def _extract_product_id_from_url(url: str) -> str | None:
    """
    Try to extract the product ID/SKU from the URL.
    Helps match images that contain the same ID in their filename.
    """
    path = urlparse(url).path.lower()
    # Common patterns: /product/ABC123, /dp/B0CXKQJ3P3, /p/12345, sku=12345
    # Also: art-625025-01, /149137/name
    patterns = [
        r"/dp/([A-Z0-9]{8,})",          # Amazon
        r"/p/(\w+)",                      # Generic /p/id
        r"art[_-]?(\d{4,})",            # art-625025
        r"/producto/(\d+)",              # Kemsa/Puma /producto/149137
        r"/(\d{5,})[/.-]",              # Numeric ID in path
        r"[/-]([A-Z]{2}\d{4,})",        # Adidas-style GW9196
    ]
    for pat in patterns:
        m = re.search(pat, path, re.I)
        if m:
            return m.group(1).lower()
    return None


def _is_junk_image_url(url_lower: str) -> bool:
    """Universal filter for non-product image URLs."""
    junk_patterns = (
        # Logos, icons, UI elements
        "logo", "icon", "favicon", "pixel", "tracking", "badge",
        "flag", ".svg", "spinner", "loading", "placeholder", "blank",
        "1x1", "spacer", "empty", "transparent",
        # Payment / trust
        "payment", "visa", "mastercard", "paypal", "amex", "diners",
        "mercadopago", "stripe", "ssl", "secure", "trust", "verified",
        "sello", "certificado",
        # Social media
        "whatsapp", "facebook", "twitter", "instagram", "youtube",
        "pinterest", "tiktok", "linkedin", "snapchat", "telegram",
        "social-icon", "share-icon",
        # Marketing / non-product
        "banner", "promo", "newsletter", "popup", "modal",
        "hero-bg", "background", "overlay", "decoration",
        "newsletter", "subscribe",
        # Navigation / structural
        "menu", "nav-icon", "footer-", "header-",
        "breadcrumb", "search-icon", "cart-icon", "wishlist-icon",
        # Shipping / service icons
        "shipping", "delivery", "truck", "return", "warranty",
        "envio", "devolucion", "garantia",
        # Rating stars
        "star-", "rating-", "estrella",
        # Size guide
        "size-guide", "guia-tallas", "size-chart",
    )
    return any(skip in url_lower for skip in junk_patterns)


def _extract_detail_images(soup: BeautifulSoup, base_url: str) -> list[str]:
    """
    UNIVERSAL product image extraction from any e-commerce detail page.

    Strategy (5 tiers, from most to least precise):
      1. JSON-LD / structured data images (most reliable, platform-agnostic)
      2. OG:image meta tag (always the hero product image)
      3. Product-specific gallery containers (platform-aware CSS selectors)
      4. Generic carousel/slider images (with exclusion filtering)
      5. Proximity-based fallback (images near h1/product title)

    Universal exclusions:
      - Related/recommended product sections (multi-language)
      - Footer, header, navigation, sidebar, aside
      - Social/payment/shipping icons
      - Marketing banners and backgrounds
      - Duplicate detection by filename (thumb vs full-size)
      - Image dimension filtering (skip tiny images)
    """
    images: list[str] = []
    seen: set[str] = set()
    seen_filenames: set[str] = set()
    product_id = _extract_product_id_from_url(base_url)
    MAX_IMAGES = 10

    def _add_img(src: str | None, from_element: Tag | None = None,
                 skip_exclusion_check: bool = False) -> bool:
        if not src:
            return False
        abs_src = _abs(base_url, src.strip())
        if not abs_src or abs_src in seen:
            return False

        lower = abs_src.lower()

        # Also check without query params (same image with different ?v=, ?width=, etc.)
        base_no_qs = lower.split("?")[0].split("#")[0]
        if base_no_qs in seen:
            return False

        # Skip junk URLs
        if _is_junk_image_url(lower):
            return False

        # Must look like an image URL (has image extension or is from a CDN)
        has_image_ext = any(base_no_qs.endswith(ext) for ext in (
            ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".bmp",
        ))
        # CDN patterns that serve images without extensions
        is_cdn_image = any(cdn in lower for cdn in (
            "/cdn/", "cloudinary", "imgix", "shopify.com/s/files",
            "cloudfront.net", "akamaized.net", "scene7.com",
            "wixstatic.com", "squarespace-cdn",
            "vteximg", "vtexassets", "kemsa.com.py",
        ))
        if not has_image_ext and not is_cdn_image and "image" not in lower:
            return False

        # Skip empty/placeholder URLs
        if base_no_qs.endswith("/") or len(base_no_qs.rsplit("/", 1)[-1]) < 3:
            return False

        # Deduplicate by normalized filename
        filename = base_no_qs.rsplit("/", 1)[-1]
        clean_name = filename
        for remove in ("thumbs/", "thumb_", "_thumb", "small_", "_small",
                        "mini_", "_mini", "tiny_", "_tiny"):
            clean_name = clean_name.replace(remove, "")
        clean_name = re.sub(r"[-_]\d+x\d+", "", clean_name)
        clean_name = re.sub(r"[-_](thumb|small|mini|tiny|large|grande|medium|medio)\b", "", clean_name)
        if clean_name in seen_filenames:
            return False
        seen_filenames.add(clean_name)

        # Check image dimensions from HTML attributes (skip tiny images)
        if from_element and from_element.name == "img":
            w = from_element.get("width")
            h = from_element.get("height")
            try:
                if w and int(str(w).replace("px", "")) < 50:
                    return False
                if h and int(str(h).replace("px", "")) < 50:
                    return False
            except (ValueError, TypeError):
                pass

        # Check if inside excluded section
        if from_element and not skip_exclusion_check:
            if _is_inside_excluded_section(from_element):
                return False

        seen.add(abs_src)
        seen.add(base_no_qs)
        images.append(abs_src)
        return True

    # ── 1. JSON-LD / Schema.org images (HIGHEST confidence) ──
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            items = data if isinstance(data, list) else [data]
            for item in items:
                if not isinstance(item, dict):
                    continue
                item_type = str(item.get("@type", ""))
                if "Product" not in item_type:
                    # Check @graph
                    for g in item.get("@graph", []):
                        if isinstance(g, dict) and "Product" in str(g.get("@type", "")):
                            item = g
                            break
                    else:
                        continue
                img = item.get("image")
                if isinstance(img, str):
                    _add_img(img, skip_exclusion_check=True)
                elif isinstance(img, list):
                    for i in img:
                        if isinstance(i, str):
                            _add_img(i, skip_exclusion_check=True)
                        elif isinstance(i, dict):
                            _add_img(i.get("url") or i.get("contentUrl"), skip_exclusion_check=True)
                elif isinstance(img, dict):
                    _add_img(img.get("url") or img.get("contentUrl"), skip_exclusion_check=True)
        except (json.JSONDecodeError, TypeError):
            continue

    # ── 2. OG:image meta tag (always the main product image) ──
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        _add_img(og_image["content"], skip_exclusion_check=True)

    # ── 3. Product-specific gallery containers (HIGH confidence) ──
    # Platform-aware selectors that target the MAIN product gallery
    primary_gallery_selectors = [
        # ── Universal / semantic ──
        "[itemprop='image']",
        "[data-zoom-image]",
        "[data-main-image] img",

        # ── Generic product gallery patterns ──
        "[class*='product-gallery'] img",
        "[class*='ProductGallery'] img",
        "[class*='product-images'] img",
        "[class*='ProductImages'] img",
        "[class*='product-photos'] img",
        "[class*='product-media'] img",
        "[class*='ProductMedia'] img",
        "[class*='product-image-gallery'] img",
        "[class*='pdp-gallery'] img",
        "[class*='pdp-image'] img",
        "[class*='pdp-media'] img",
        "[id*='product-gallery'] img",
        "[id*='product-images'] img",
        "[id*='ProductImage'] img",

        # ── Shopify ──
        ".product__media-list img",
        ".product__media img",
        ".product-single__media img",
        ".product-featured-media img",
        "[data-product-media-type='image'] img",
        ".product__main-photos img",

        # ── WooCommerce ──
        ".woocommerce-product-gallery img",
        ".woocommerce-product-gallery__image img",
        ".flex-viewport img",
        ".woocommerce-main-image img",

        # ── Magento ──
        ".fotorama__stage img",
        ".gallery-placeholder img",
        "[data-gallery-role='gallery'] img",

        # ── Tiendanube / Nuvemshop ──
        "[data-component='product.gallery'] img",
        ".js-product-slide img",
        ".product-gallery img",
        "#product-image img",

        # ── VTEX ──
        ".vtex-store-components-3-x-productImageTag",
        "[class*='productImageTag'] img",
        ".swiper-slide [class*='productImage'] img",

        # ── PrestaShop ──
        ".product-cover img",
        ".js-qv-product-cover img",
        "#product-images-thumbs img",

        # ── Custom / regional stores ──
        ".container-carousel img",
        ".container-img img",
        ".slider-foto-grande img",
        ".slider-nav img",
        ".foto-producto img",
        ".imagen-producto img",
        ".detalle-imagen img",

        # ── Lightbox / zoom (usually product images) ──
        "[class*='lightbox'] img",
        "[class*='zoom'] img",
        "[class*='Zoom'] img",
        "[class*='magnif'] img",
        "[class*='pswp'] img",          # PhotoSwipe
        "a[data-fancybox] img",         # Fancybox
        "[data-lightbox] img",
    ]

    for sel in primary_gallery_selectors:
        if len(images) >= MAX_IMAGES:
            break
        try:
            elements = soup.select(sel)
        except Exception:
            continue
        for el in elements:
            if _is_inside_excluded_section(el):
                continue

            if el.name == "img":
                src = (el.get("data-zoom-image") or el.get("data-large") or
                       el.get("data-full") or el.get("data-hi-res") or
                       el.get("data-src") or el.get("data-lazy-src") or
                       el.get("data-lazy") or el.get("data-original") or
                       el.get("data-image") or el.get("srcset", "").split(",")[0].split(" ")[0] or
                       el.get("src"))
                _add_img(src, el)
            else:
                for attr in ("data-zoom-image", "data-large", "data-full",
                             "data-hi-res", "data-src", "href", "content", "src"):
                    val = el.get(attr)
                    if val and not val.startswith(("#", "javascript:")):
                        if _add_img(val, el):
                            break
            if len(images) >= MAX_IMAGES:
                break

    # ── 4. Generic carousel/slider images (MEDIUM confidence) ──
    if len(images) < 3:
        carousel_selectors = [
            ".swiper-slide img",
            ".splide__slide img",
            ".slick-slide img",
            ".owl-item img",
            ".glide__slide img",
            ".flickity-slider img",
            ".carousel-item img",
            ".keen-slider__slide img",
            "[class*='slide'] > img",
        ]

        for sel in carousel_selectors:
            if len(images) >= MAX_IMAGES:
                break
            try:
                elements = soup.select(sel)
            except Exception:
                continue
            for el in elements:
                if _is_inside_excluded_section(el):
                    continue
                src = (el.get("data-src") or el.get("data-lazy-src") or
                       el.get("data-lazy") or el.get("data-original") or
                       el.get("src"))
                _add_img(src, el)
                if len(images) >= MAX_IMAGES:
                    break

    # ── 5. Fallback: images near the product title (LOW confidence) ──
    if len(images) < 2:
        h1 = soup.find("h1")
        if h1:
            # Walk up DOM from h1 to find the product container
            product_section = h1.parent
            for _ in range(5):  # Go up a few levels
                if not product_section or not isinstance(product_section, Tag):
                    break
                section_imgs = product_section.find_all("img", recursive=True)
                # Filter: only consider if reasonable number of images
                valid_imgs = [img for img in section_imgs
                              if not _is_inside_excluded_section(img)]
                if 1 <= len(valid_imgs) <= 15:
                    for img in valid_imgs[:MAX_IMAGES]:
                        src = (img.get("data-src") or img.get("data-lazy-src") or
                               img.get("src"))
                        _add_img(src, img)
                    break
                product_section = product_section.parent

    # ── 6. Last resort: if product_id found in URL, look for images matching it ──
    if len(images) < 2 and product_id:
        all_imgs = soup.find_all("img", src=True)
        for img in all_imgs:
            if len(images) >= MAX_IMAGES:
                break
            src = img.get("src", "")
            if product_id in src.lower():
                _add_img(src, img)

    return images


def _is_likely_product_url(url: str) -> bool:
    """
    Heuristic: check if a URL looks like a product detail page vs a category/promo/banner.
    Product URLs usually contain patterns like /product/, /p/, /producto/, or SKU-like segments.
    Non-product URLs are categories, promos, brand pages, etc.

    Strategy: whitelist known product URL patterns. Everything else is suspect.
    """
    parsed = urlparse(url)
    path = parsed.path.lower().rstrip("/")
    qs = parsed.query.lower()

    # ── Definite product URL patterns (high confidence) ──
    product_patterns = [
        "/product/", "/products/", "/producto/", "/productos/",
        "/p/", "/dp/", "/item/", "/articulo/",
        ".html",  # Many stores use product-name.html
    ]
    if any(pp in path for pp in product_patterns):
        return True

    # URL ends with -pNNNNN (e.g. /jabon-omo-p42658)
    last_segment = path.rsplit("/", 1)[-1] if "/" in path else path
    if re.search(r"-p\d{3,}$", last_segment):
        return True

    # ── Definite NON-product URL patterns ──
    non_product_patterns = [
        "/catalogo", "/catalog", "/categoria", "/category", "/categories",
        "/coleccion", "/collection", "/collections",
        "/promocion", "/promo", "/sale", "/ofertas", "/descuento",
        "/marca", "/brand", "/brands",
        "/familia/", "/family/",
        "/buscar", "/search", "/buscador",
        "/contacto", "/contact",
        "/nosotros", "/about",
        "/blog", "/noticias", "/news",
        "/mi-lista", "/mi-cuenta", "/my-account", "/cart", "/carrito",
        "/checkout", "/ingresar", "/login", "/register",
        "/faq", "/ayuda", "/help", "/terminos", "/terms",
        "/envios", "/shipping", "/devoluciones", "/returns",
    ]
    if any(npp in path for npp in non_product_patterns):
        return False

    # UTM parameters = marketing/landing page
    if "utm_source" in qs or "utm_medium" in qs or "utm_campaign" in qs:
        return False

    # Search/filter params
    if any(qp in qs for qp in ("q=", "buscar=", "search=", "category=", "sale")):
        return False

    # ── Shallow paths (1 segment like /vizzio, /dog_lover) are usually ──
    # ── brand pages, promos, or landing pages — NOT product pages ──
    path_segments = [s for s in path.split("/") if s]
    if len(path_segments) <= 1:
        # Exception: if the single segment contains a dash with many words,
        # it might be a product slug (e.g. /jabon-omo-liquido-ultra-power-1-8ml-p42658)
        if last_segment and (
            "-p" in last_segment and re.search(r"\d{3,}", last_segment)
        ):
            return True
        # Single-word paths are almost never products
        return False

    # ── Deep paths with hyphens/underscores look more like products ──
    if len(path_segments) >= 2 and "-" in last_segment and len(last_segment) > 10:
        return True

    # ── Paths with numeric IDs are likely products ──
    if re.search(r"/\d{3,}", path):
        return True

    return True  # Give benefit of the doubt for deeper paths


def _enrich_products_from_detail_pages(
    client: httpx.Client,
    products: list[ScrapedProduct],
    max_enrichments: int = 30,
) -> list[ScrapedProduct]:
    """
    Visit EVERY product's detail page to get the REAL data:
    description, full image gallery, compare price, SKU, stock.

    WHY: Catalog pages only show name + price + thumbnail.
    The actual description, all images, etc. are ONLY on the product's
    individual page. Every e-commerce platform (WooCommerce, Shopify,
    Tiendanube, Magento, etc.) puts the full product info on its own URL.

    Performance guards:
    - Max 30 HTTP enrichments (fast, ~1-2s each)
    - Max 5 browser enrichments (slow, ~8-10s each)
    - Skip URLs that don't look like product pages
    - Global time limit of 90 seconds
    """
    import time
    enriched = []
    enrichment_count = 0
    browser_enrichment_count = 0
    max_browser_enrichments = 5
    start_time = time.time()
    max_enrichment_time = 90  # seconds

    for product in products:
        # Time guard
        if time.time() - start_time > max_enrichment_time:
            logger.info(f"Enrichment time limit reached ({max_enrichment_time}s), "
                        f"enriched {enrichment_count}/{len(products)} products")
            enriched.append(product)
            continue

        if not product.detail_url or enrichment_count >= max_enrichments:
            enriched.append(product)
            continue

        # Skip non-product URLs (categories, promos, brand pages)
        if not _is_likely_product_url(product.detail_url):
            logger.debug(f"Skipping non-product URL: {product.detail_url}")
            enriched.append(product)
            continue

        logger.info(f"Enriching [{enrichment_count+1}/{len(products)}]: {product.name}")
        detail = _scrape_product_detail(client, product.detail_url)

        # If HTTP scraping failed, try browser — but limit attempts
        if not detail and browser_enrichment_count < max_browser_enrichments:
            detail = _scrape_product_detail_with_browser(product.detail_url)
            browser_enrichment_count += 1

        if detail:
            # Merge: ALWAYS prefer detail page data (it's the authoritative source)
            # Catalog data is just thumbnails — detail page has the REAL info
            enriched.append(ScrapedProduct(
                name=detail.name or product.name,
                description=_pick_best_description(detail.description, product.description),
                price=detail.price or product.price,
                compare_at_price=detail.compare_at_price or product.compare_at_price,
                image_urls=detail.image_urls if detail.image_urls else product.image_urls,
                sku=detail.sku or product.sku,
                stock_quantity=detail.stock_quantity if detail.stock_quantity is not None else product.stock_quantity,
                detail_url=product.detail_url,
            ))
            enrichment_count += 1
        else:
            # Keep original catalog data if detail page failed
            enriched.append(product)

    logger.info(f"Enrichment complete: {enrichment_count}/{len(products)} products enriched")
    return enriched


def _pick_best_description(detail_desc: str | None, catalog_desc: str | None) -> str | None:
    """
    Choose the best description between the detail page and catalog.
    Prefer the LONGER one since detail pages have the full description.
    """
    if not detail_desc:
        return catalog_desc
    if not catalog_desc:
        return detail_desc
    # Return the longer one (detail page usually has the full description)
    return detail_desc if len(detail_desc) >= len(catalog_desc) else catalog_desc


def _scrape_product_detail_with_browser(url: str) -> ScrapedProduct | None:
    """
    Fallback: render a product detail page with Playwright when HTTP failed.
    Used for JS-heavy product pages (React, Vue, Angular, etc.).
    """
    try:
        from app.services.browser_renderer import render_product_detail

        browser_result = render_product_detail(url)
        if browser_result.error or not browser_result.html:
            return None

        parser = "lxml" if _has_lxml() else "html.parser"
        soup = BeautifulSoup(browser_result.html, parser)

        # Try JSON-LD from rendered page
        products = _extract_jsonld_products(soup, url)
        if products:
            product = products[0]
            # ALWAYS get gallery from HTML (JSON-LD often has fewer images)
            page_images = _extract_detail_images(soup, url)
            if page_images:
                if len(page_images) > len(product.image_urls):
                    seen = set(page_images)
                    merged = list(page_images)
                    for img in product.image_urls:
                        if img not in seen:
                            merged.append(img)
                            seen.add(img)
                    product.image_urls = merged[:10]
                else:
                    seen = set(product.image_urls)
                    for img in page_images:
                        if img not in seen:
                            product.image_urls.append(img)
                            seen.add(img)
                    product.image_urls = product.image_urls[:10]

            product.detail_url = url
            if product.stock_quantity is None:
                product.stock_quantity = _extract_stock_from_html(soup)

            # ALWAYS try HTML description (it's the real one)
            html_description = _extract_html_description(soup)
            if html_description and len(html_description) > len(product.description or ""):
                product.description = html_description

            logger.info(f"Browser enrichment found product: {product.name}")
            return product

        # Manual HTML extraction
        name = None
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(strip=True)[:255]
        if not name:
            og_title = soup.find("meta", property="og:title")
            if og_title and og_title.get("content"):
                name = og_title["content"].strip()[:255]
        if not name:
            return None

        # Description: use centralized extraction
        description = _extract_html_description(soup)

        images = _extract_detail_images(soup, url)

        price = None
        for ps in PRICE_SELECTORS:
            try:
                price_el = soup.select_one(ps)
            except Exception:
                continue
            if price_el:
                price = _parse_price(price_el.get_text(strip=True))
                if price:
                    break

        stock = _extract_stock_from_html(soup)

        logger.info(f"Browser enrichment (manual) found: {name}")
        return ScrapedProduct(
            name=name,
            description=description,
            price=price,
            image_urls=images[:8],
            stock_quantity=stock,
            detail_url=url,
        )

    except ImportError:
        return None
    except Exception as e:
        logger.debug(f"Browser detail page scrape failed for {url}: {e}")
        return None


def _scrape_product_page(client: httpx.Client, url: str) -> ScrapedProduct | None:
    """Alias for backward compatibility with sitemap discovery."""
    return _scrape_product_detail(client, url)


# ---------------------------------------------------------------------------
# Main scrape function
# ---------------------------------------------------------------------------

def _fetch_css(client: httpx.Client, soup: BeautifulSoup, base_url: str) -> list[str]:
    """Download external stylesheets (max 3, max 200KB each)."""
    css_texts: list[str] = []
    links = soup.find_all("link", rel="stylesheet", href=True)
    for link in links[:3]:
        href = _abs(base_url, link["href"])
        if not href:
            continue
        try:
            resp = client.get(href, timeout=8)
            if resp.status_code == 200 and len(resp.content) < 200_000:
                css_texts.append(resp.text)
        except Exception:
            continue
    return css_texts


def _fetch_page(url: str) -> tuple[str, httpx.Client]:
    """Fetch page HTML trying multiple browser profiles to avoid 403 blocks."""
    last_error = None
    parsed = urlparse(url)
    referer = f"{parsed.scheme}://{parsed.netloc}/"

    for i, profile in enumerate(BROWSER_PROFILES):
        headers = {**profile, "Referer": referer}
        client = httpx.Client(
            headers=headers,
            follow_redirects=True,
            timeout=SCRAPE_TIMEOUT,
            verify=False,
        )
        try:
            resp = client.get(url)
            if resp.status_code == 403 and i < len(BROWSER_PROFILES) - 1:
                logger.info(f"Got 403 with profile {i}, trying next profile")
                client.close()
                continue
            resp.raise_for_status()
            return resp.text, client
        except httpx.HTTPStatusError as e:
            last_error = e
            client.close()
            if e.response.status_code != 403 or i == len(BROWSER_PROFILES) - 1:
                raise
        except Exception:
            client.close()
            raise

    raise last_error or ValueError("No se pudo acceder al sitio")


def _extract_products_from_soup(
    soup: BeautifulSoup,
    html: str,
    url: str,
    client: httpx.Client | None,
    all_products: list[ScrapedProduct],
    seen_names: set[str],
    source_tag: str = "",
) -> None:
    """
    Run all extraction strategies on a soup/html and append unique products.
    Used for both Phase 1 (HTTP) and Phase 2 (browser-rendered HTML).
    """
    tag = f" [{source_tag}]" if source_tag else ""

    def _add_products(new_products: list[ScrapedProduct], source: str):
        count = 0
        for p in new_products:
            if p.name not in seen_names and len(all_products) < MAX_SITEMAP_PRODUCTS:
                seen_names.add(p.name)
                all_products.append(p)
                count += 1
        if count:
            logger.info(f"Found {count} new products via {source}{tag} (total: {len(all_products)})")

    # Strategy 1: JSON-LD
    _add_products(_extract_jsonld_products(soup, url), "JSON-LD")

    # Strategy 2: Extruct
    _add_products(_extract_extruct_products(html, url), "extruct")

    # Strategy 3: HTML selectors
    _add_products(_extract_html_products(soup, url), "HTML selectors")

    # Strategy 4: AJAX discovery (only if we have a client, and found few products)
    if client and len(all_products) < 5:
        ajax_endpoints = _discover_ajax_endpoints(soup, url)
        if ajax_endpoints:
            logger.info(f"Discovered {len(ajax_endpoints)} potential AJAX endpoints{tag}")
            _add_products(_fetch_ajax_products(client, ajax_endpoints, url), "AJAX")

    # Strategy 5: Generic grid detection
    if len(all_products) < 5:
        _add_products(_extract_generic_grid(soup, url), "generic grid")

    # Strategy 6: OpenGraph (single product only)
    if not all_products:
        _add_products(_extract_og_product(soup, url), "OpenGraph")

    # ── Post-extraction: Enrich descriptions from the SAME page HTML ──
    # When JSON-LD has empty descriptions but the HTML has them visible,
    # extract descriptions from CSS selectors on the current soup.
    # This is critical for single-product pages (detail pages) where
    # the JSON-LD description is empty but the page shows the full description.
    _DESC_SELECTORS = [
        "[itemprop='description']",
        ".woocommerce-product-details__short-description",
        ".woocommerce-Tabs-panel--description",
        "#tab-description",
        "[class*='description']", "[class*='Description']",
        "[class*='detalle']", "[class*='detail']",
        "[id*='description']", "[id*='detalle']",
        ".product-description", ".product-detail",
        "[class*='product-body']", "[class*='product-content']",
        "[class*='product-info']", "[class*='product-text']",
        "[class*='ProductDescription']", "[class*='pdp-description']",
        "[class*='overview']", "[class*='Overview']",
        "[class*='specs']", "[class*='specifications']",
        "[class*='features']", "[class*='Features']",
        "[data-testid*='description']",
        "article .entry-content",
        ".product-single__description",
        ".entry-summary",
        ".summary .description",
    ]
    products_without_desc = [p for p in all_products if not p.description or len(p.description) < 50]
    if products_without_desc and len(all_products) <= 5:
        # Only do this for small product counts (detail pages or small catalogs)
        # For large catalogs, enrichment handles it
        for p in products_without_desc:
            for sel in _DESC_SELECTORS:
                try:
                    el = soup.select_one(sel)
                except Exception:
                    continue
                if el:
                    text = _html_to_clean_text(el)
                    if text and len(text) > 30 and not _is_junk_description(text) and len(text) > len(p.description or ""):
                        p.description = text[:2000]
                        logger.debug(f"Enriched description from HTML ({sel}): {len(text)} chars")
                        break


def _extract_store_name(soup: BeautifulSoup) -> str | None:
    """Extract store/brand name from meta tags or title."""
    og_name = soup.find("meta", property="og:site_name")
    if og_name and og_name.get("content"):
        return og_name["content"].strip()
    title_el = soup.find("title")
    if title_el:
        raw = title_el.get_text(strip=True)
        parts = re.split(r"\s*[|–—-]\s*", raw)
        if len(parts) > 1:
            return parts[-1].strip()[:100]
        return raw.strip()[:100]
    return None


# Minimum products to consider Phase 1 "sufficient" (skip browser)
MIN_PRODUCTS_SKIP_BROWSER = 3


def scrape_url(url: str) -> ScrapeResult:
    """
    Scrape a URL and return structured data about products, design and sections.
    This is the main entry point for the scraping service.

    Works with ANY web technology:
    - Static HTML, SSR (Next.js, Nuxt, PHP, Rails, Django)
    - JavaScript SPAs (React, Vue, Angular, Svelte)
    - Headless commerce (Shopify Hydrogen, Medusa, Saleor)
    - Platforms (Shopify, WooCommerce, Tiendanube, MercadoLibre, Wix, Webflow)
    - Bot-protected sites (Cloudflare, etc.)
    - Infinite scroll, lazy loading, dynamic content

    Phase 1: Fast HTTP scraping (httpx) — works for ~70% of sites
    Phase 2: Browser rendering (Playwright/Chromium) — fallback for JS-heavy sites
    """
    import time as _time
    _scrape_start = _time.time()

    url = _validate_url(url)
    result = ScrapeResult()
    client = None
    all_products: list[ScrapedProduct] = []
    seen_names: set[str] = set()
    http_failed = False

    # ══════════════════════════════════════════════════════════════
    # PHASE 1: Fast HTTP scraping
    # ══════════════════════════════════════════════════════════════
    try:
        html, client = _fetch_page(url)
        parser = "lxml" if _has_lxml() else "html.parser"
        soup = BeautifulSoup(html, parser)

        result.store_name = _extract_store_name(soup)

        # Detect currency from JSON-LD/meta tags in the first page load
        result.detected_currency = _detect_currency_from_html(html, url)

        _extract_products_from_soup(
            soup, html, url, client,
            all_products, seen_names,
            source_tag="HTTP",
        )

        # Strategy 7: Sitemap discovery (HTTP only)
        if len(all_products) < 3:
            try:
                product_urls = _discover_product_urls(client, url)
                if product_urls:
                    logger.info(f"Found {len(product_urls)} URLs from sitemap")
                for purl in product_urls:
                    if len(all_products) >= MAX_SITEMAP_PRODUCTS:
                        break
                    prod = _scrape_product_page(client, purl)
                    if prod and prod.name not in seen_names:
                        seen_names.add(prod.name)
                        all_products.append(prod)
            except Exception as e:
                logger.warning(f"Sitemap discovery failed: {e}")

        logger.info(f"Phase 1 (HTTP) found {len(all_products)} products")

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 403:
            logger.info(f"HTTP blocked (403) — will try browser rendering")
            http_failed = True
        else:
            # For non-403 errors, still try browser before giving up
            logger.warning(f"HTTP error {code} — will try browser rendering")
            http_failed = True
    except (httpx.TimeoutException, httpx.ConnectError) as e:
        logger.warning(f"HTTP connection failed ({type(e).__name__}) — will try browser rendering")
        http_failed = True
    except Exception as e:
        logger.warning(f"HTTP scraping failed ({type(e).__name__}: {e}) — will try browser rendering")
        http_failed = True
    finally:
        if client:
            client.close()
            client = None

    # ══════════════════════════════════════════════════════════════
    # PHASE 2: Browser rendering (Playwright) — fallback
    # Only runs if Phase 1 found too few products or failed entirely
    # ══════════════════════════════════════════════════════════════
    need_browser = http_failed or len(all_products) < MIN_PRODUCTS_SKIP_BROWSER
    time_remaining = MAX_TOTAL_SCRAPE_TIME - (_time.time() - _scrape_start)

    if need_browser and time_remaining > 20:
        logger.info(
            f"Phase 2: launching browser renderer "
            f"(HTTP {'failed' if http_failed else f'found only {len(all_products)} products'})"
        )
        try:
            from app.services.browser_renderer import render_page

            browser_result = render_page(url, scroll_for_more=True)

            if browser_result.error:
                logger.warning(f"Browser rendering error: {browser_result.error}")

            # Si quedó bloqueado y no tenemos productos, informar al usuario
            if browser_result.was_blocked and not all_products:
                protection = browser_result.protection_type or "desconocida"
                protection_messages = {
                    "cloudflare": (
                        "El sitio está protegido por Cloudflare y bloqueó el acceso automático. "
                        "Probá con una URL más específica (ej: la página de una categoría o producto individual) "
                        "o intentá de nuevo en unos minutos."
                    ),
                    "cloudflare_turnstile": (
                        "El sitio usa Cloudflare Turnstile (verificación anti-bot avanzada). "
                        "Probá con una URL de una categoría o producto específico, "
                        "o importá los productos manualmente."
                    ),
                    "akamai": (
                        "El sitio está protegido por Akamai Bot Manager. "
                        "Probá acceder a una categoría específica o producto individual."
                    ),
                    "perimeterx": (
                        "El sitio usa protección HUMAN/PerimeterX anti-bot. "
                        "Probá con la URL de un producto o categoría específica."
                    ),
                    "datadome": (
                        "El sitio está protegido por DataDome. "
                        "Intentá con la URL de un producto o categoría específica."
                    ),
                    "captcha": (
                        "El sitio requiere resolver un CAPTCHA que no se puede completar automáticamente. "
                        "Probá con una URL diferente del mismo sitio o importá los productos manualmente."
                    ),
                }
                msg = protection_messages.get(protection, (
                    f"El sitio tiene protección anti-bot ({protection}) que bloqueó el acceso. "
                    "Probá con la URL de una categoría o producto específico, "
                    "o intentá de nuevo en unos minutos."
                ))
                logger.warning(f"Site blocked by {protection} after {browser_result.attempts} attempts")
                # No lanzar error todavía — quizás extrajimos algo del HTML parcial

            if browser_result.html:
                parser = "lxml" if _has_lxml() else "html.parser"
                browser_soup = BeautifulSoup(browser_result.html, parser)
                browser_url = browser_result.url_after_redirects or url

                # Extract store name if we don't have it yet
                if not result.store_name:
                    result.store_name = _extract_store_name(browser_soup)

                # Process intercepted JSON data first (highest quality)
                if browser_result.intercepted_json:
                    for json_data in browser_result.intercepted_json:
                        json_products = _parse_json_products(json_data, browser_url)
                        count = 0
                        for p in json_products:
                            if p.name not in seen_names and len(all_products) < MAX_SITEMAP_PRODUCTS:
                                seen_names.add(p.name)
                                all_products.append(p)
                                count += 1
                        if count:
                            logger.info(
                                f"Found {count} products from intercepted JSON "
                                f"(total: {len(all_products)})"
                            )

                # Run all extraction strategies on the rendered HTML
                _extract_products_from_soup(
                    browser_soup, browser_result.html, browser_url, None,
                    all_products, seen_names,
                    source_tag="browser",
                )

                # Also extract design from rendered page if we don't have it
                if not result.design or not result.design.primary_color:
                    try:
                        css_texts: list[str] = []
                        for style in browser_soup.find_all("style"):
                            css_texts.append(style.string or "")
                        result.design = _extract_design(browser_soup, browser_url, css_texts)
                    except Exception:
                        pass

                # Extract sections from rendered page
                if not result.sections:
                    result.sections = _extract_sections(browser_soup, browser_url)

                logger.info(
                    f"Phase 2 (browser) total: {len(all_products)} products"
                )

        except ImportError:
            logger.warning("Playwright not available — browser rendering skipped")
            if http_failed and not all_products:
                raise ValueError(
                    "No se pudieron obtener productos. El sitio puede requerir "
                    "JavaScript para funcionar. Instalá Playwright para habilitar "
                    "el renderizado con navegador."
                )
        except Exception as e:
            logger.error(f"Browser rendering failed: {e}", exc_info=True)
            if http_failed and not all_products:
                raise ValueError(
                    f"No se pudieron obtener productos del sitio. "
                    f"Error: {str(e)[:200]}"
                )

    # ══════════════════════════════════════════════════════════════
    # ENRICHMENT: Visit EVERY product's detail page for complete data
    # The catalog page only has name/price/thumbnail.
    # The REAL description, gallery, SKU, stock → only on the detail page.
    # ══════════════════════════════════════════════════════════════
    time_remaining = MAX_TOTAL_SCRAPE_TIME - (_time.time() - _scrape_start)
    if all_products and time_remaining > 10:
        # Enrich ALL products that have a detail URL
        # Prioritize: products without description first, then those with short descriptions
        products_with_url = [p for p in all_products if p.detail_url]
        products_needing_enrichment = sorted(
            products_with_url,
            key=lambda p: len(p.description or ""),  # shortest descriptions first
        )
        if products_needing_enrichment:
            logger.info(
                f"Enriching {len(products_needing_enrichment)} products "
                f"from their detail pages... (time remaining: {time_remaining:.0f}s)"
            )
            # Open a fresh HTTP client for enrichment
            enrichment_client = httpx.Client(
                headers={**BROWSER_PROFILES[0], "Referer": url},
                follow_redirects=True,
                timeout=min(SCRAPE_TIMEOUT, 15),  # Shorter timeout per request
                verify=False,
            )
            try:
                all_products = _enrich_products_from_detail_pages(
                    enrichment_client, all_products, max_enrichments=30
                )
            finally:
                enrichment_client.close()

    result.products = all_products

    # Design & sections (if not already extracted by browser phase)
    if not result.design or not result.design.primary_color:
        # Try from HTTP soup if available
        try:
            if not http_failed:
                html_again, client2 = _fetch_page(url)
                soup2 = BeautifulSoup(html_again, "lxml" if _has_lxml() else "html.parser")
                css_texts = _fetch_css(client2, soup2, url)
                result.design = _extract_design(soup2, url, css_texts)
                if not result.sections:
                    result.sections = _extract_sections(soup2, url)
                client2.close()
        except Exception:
            pass

    if not result.design:
        result.design = ScrapedDesign()
    if not result.sections:
        result.sections = []

    if not all_products:
        # Si fue bloqueado, lanzar error con mensaje claro sobre la protección
        if need_browser:
            try:
                if browser_result.was_blocked:  # type: ignore[union-attr]
                    protection = browser_result.protection_type or "anti-bot"  # type: ignore[union-attr]
                    raise ValueError(
                        f"El sitio tiene protección {protection} que bloqueó el acceso automático. "
                        "Podés intentar:\n"
                        "• Usar la URL de una categoría o producto específico en vez de la página principal\n"
                        "• Esperar unos minutos e intentar de nuevo\n"
                        "• Importar los productos manualmente"
                    )
            except NameError:
                pass  # browser_result no existe si no se ejecutó Phase 2

        logger.warning(f"No products found at {url} after all strategies")

    return result


def _has_lxml() -> bool:
    try:
        import lxml  # noqa: F401
        return True
    except ImportError:
        return False
