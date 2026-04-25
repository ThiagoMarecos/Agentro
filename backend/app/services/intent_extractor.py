"""
Intent Extractor — analiza el mensaje del cliente y devuelve qué necesita
consultarse en la DB ANTES de llamar al LLM.

Es la primera mitad de la arquitectura "Context-First": en vez de dejar
que el LLM decida cuándo llamar tools (probabilístico), este módulo
escanea el mensaje DETERMINÍSTICAMENTE y le dice al `context_prefetcher`
qué traer.

Tier 1: regex + heurísticas (este archivo). Cubre ~85% de los casos típicos
de e-commerce: queries de productos, stock, precios, descuentos, datos
personales del cliente.

Tier 2 (futuro): si el Tier 1 no detecta nada útil y el mensaje es ambiguo,
se podría hacer una llamada barata a gpt-4o-mini con response_format JSON
para extraer entidades. No implementado todavía.
"""

import logging
import re
import unicodedata
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Intent:
    """Resultado del intent extractor — instrucciones para el prefetcher."""

    # Términos a buscar como productos en la DB.
    # Ej: ["remera negra", "talle M"] → product_search por cada uno.
    product_queries: list[str] = field(default_factory=list)

    # ¿El cliente está preguntando explícitamente por stock/disponibilidad?
    needs_stock_check: bool = False

    # ¿El cliente está preguntando por precio?
    needs_price_info: bool = False

    # ¿El cliente está preguntando por descuentos / ofertas?
    needs_discounts: bool = False

    # ¿Pidió ver el catálogo / qué tienen?
    needs_catalog_overview: bool = False

    # ¿Pidió hablar con humano explícitamente?
    wants_human: bool = False

    # ¿Mencionó intent de avanzar / comprar?
    wants_to_proceed: bool = False

    # Datos personales detectados en el mensaje (para guardar en notebook).
    detected_phone: str | None = None
    detected_email: str | None = None
    detected_address: str | None = None  # heurística básica

    # Mensaje normalizado (lowercase + sin tildes) para debugging.
    normalized: str = ""

    def is_empty(self) -> bool:
        """True si no se detectó nada accionable."""
        return not (
            self.product_queries
            or self.needs_stock_check
            or self.needs_price_info
            or self.needs_discounts
            or self.needs_catalog_overview
            or self.wants_human
            or self.wants_to_proceed
            or self.detected_phone
            or self.detected_email
            or self.detected_address
        )


# ════════════════════════════════════════════════════════════════════
#  Helpers de normalización
# ════════════════════════════════════════════════════════════════════

def _normalize(text: str) -> str:
    """Lowercase + quita tildes. Para matching tolerante."""
    if not text:
        return ""
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode("ascii")


# ════════════════════════════════════════════════════════════════════
#  Patrones de detección
# ════════════════════════════════════════════════════════════════════

# Sustantivos comunes de productos en español/inglés (categorías genéricas).
# Cuando aparecen en el mensaje, los tratamos como product_queries.
# El context_prefetcher los va a buscar en la DB.
_PRODUCT_NOUNS = {
    # Ropa
    "remera", "remeras", "playera", "playeras", "camiseta", "camisetas",
    "tee", "tees", "tshirt", "polera", "poleras",
    "campera", "camperas", "chaqueta", "chaquetas", "jacket", "jackets",
    "buzo", "buzos", "sudadera", "sudaderas", "hoodie", "hoodies", "canguro",
    "pantalon", "pantalones", "pant", "pants", "jean", "jeans",
    "short", "shorts", "bermuda", "bermudas",
    "vestido", "vestidos", "dress", "falda", "faldas", "pollera",
    "saco", "blazer", "abrigo", "abrigos",
    "musculosa", "musculosas", "top", "tops",
    "ropa", "outfit", "look",
    # Calzado
    "zapatilla", "zapatillas", "tenis", "sneaker", "sneakers", "championes",
    "zapato", "zapatos", "bota", "botas", "borcego", "ojota", "ojotas",
    # Accesorios
    "gorra", "gorras", "cap", "visera", "viseras",
    "mochila", "mochilas", "backpack", "bolso", "bolsos", "cartera", "carteras",
    "billetera", "billeteras",
    "reloj", "relojes", "watch",
    "anteojos", "lentes", "gafas", "sunglasses",
    "cinturon", "cinturones", "cinto",
    # Tech
    "celular", "celulares", "telefono", "smartphone", "iphone", "samsung",
    "auriculares", "auricular", "headphones", "earbuds",
    "notebook", "laptop", "computadora", "pc",
    "tablet", "ipad",
    "cargador", "cargadores", "cable",
    # Hogar
    "silla", "sillas", "mesa", "mesas", "sillon", "sofa",
    "lampara", "lamparas",
    # Belleza
    "perfume", "perfumes", "shampoo", "crema", "cremas",
    "labial", "rimel", "base",
    # Genéricos catch-all (cuando dice "tenés algún X" sin nombrar producto)
    "modelo", "modelos", "color", "colores", "talle", "talla", "talles", "tallas",
}

# Frases que indican "decime qué tenés" — pedido de catálogo.
_CATALOG_OVERVIEW_PHRASES = [
    "que venden", "que tienen", "que vende", "que tiene",
    "que hay", "tenes catalogo", "tienes catalogo",
    "muestrame todo", "ver todo", "ver el catalogo",
    "mostrame", "que productos",
]

# Frases que indican query de stock / disponibilidad.
_STOCK_QUERY_PHRASES = [
    "tenes", "tienes", "hay", "queda", "quedan", "tienen",
    "disponible", "disponibles", "disponibilidad",
    "stock", "en stock",
]

# Frases que indican query de precio.
_PRICE_QUERY_PHRASES = [
    "cuanto", "precio", "precios", "vale", "valen",
    "sale", "salen", "cuesta", "cuestan",
]

# Frases que indican query de descuento / oferta.
_DISCOUNT_PHRASES = [
    "descuento", "descuentos", "oferta", "ofertas",
    "promo", "promocion", "promociones", "rebaja", "rebajas",
    "barato", "mas barato", "menor precio", "mejor precio",
]

# Frases que indican que el cliente quiere hablar con humano.
_HUMAN_PHRASES = [
    "hablar con humano", "hablar con persona", "hablar con vendedor",
    "atencion humana", "una persona", "un humano", "no quiero hablar con bot",
    "encargado", "supervisor", "responsable",
]

# Frases que indican intent de avanzar / comprar.
_PROCEED_PHRASES = [
    "lo quiero", "lo llevo", "me lo llevo", "comprar", "comprarlo",
    "avanzar", "seguir", "cerrar", "confirmar", "confirmo",
    "lo compro", "te lo pago", "transfiero", "transferencia",
    "dale", "perfecto, avancemos", "vamos",
]

# Tamaños / talles — los tratamos como modificadores de un product_query.
_SIZE_PATTERN = re.compile(
    r"\b(?:talle|talla|size)\s*([smlx]+|\d{2,3})\b|\b([smlx]{1,3})\b\s*(?:talle|talla)?",
    re.IGNORECASE,
)

# Teléfono argentino / latam: 10-13 dígitos, opcional +, espacios o guiones.
_PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s\-]{8,14}\d)")
# Email simple
_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# Heurística de dirección: contiene palabra clave + número
_ADDRESS_PATTERN = re.compile(
    r"\b(?:calle|av\.?|avenida|ruta|barrio|villa|pasaje|diagonal)\s+[a-z\s]+\s+\d+",
    re.IGNORECASE,
)


# ════════════════════════════════════════════════════════════════════
#  Extractor principal
# ════════════════════════════════════════════════════════════════════

def extract(
    user_message: str,
    conversation_history: list[dict] | None = None,
    notebook: dict | None = None,
) -> Intent:
    """
    Analiza el mensaje del cliente y retorna un Intent con qué necesita
    consultarse en la DB.

    Args:
        user_message: el mensaje crudo del cliente
        conversation_history: lista de mensajes previos (opcional, para contexto)
        notebook: notebook actual del SalesSession (opcional, para evitar
                  re-pedir info ya conocida)

    Returns:
        Intent con flags y queries detectadas.
    """
    intent = Intent()
    if not user_message:
        return intent

    raw = user_message
    norm = _normalize(user_message)
    intent.normalized = norm

    # ── Datos personales (regex sobre el texto crudo, no normalizado) ──
    phone_match = _PHONE_PATTERN.search(raw)
    if phone_match:
        candidate = phone_match.group(0).strip()
        # Filtramos números muy cortos o muy largos (cuentas, no son teléfonos)
        digits_only = re.sub(r"[^\d]", "", candidate)
        if 10 <= len(digits_only) <= 13:
            intent.detected_phone = candidate

    email_match = _EMAIL_PATTERN.search(raw)
    if email_match:
        intent.detected_email = email_match.group(0)

    address_match = _ADDRESS_PATTERN.search(raw)
    if address_match:
        intent.detected_address = address_match.group(0)

    # ── Catalog overview (query general "qué tenés/venden") ──
    if any(p in norm for p in _CATALOG_OVERVIEW_PHRASES):
        intent.needs_catalog_overview = True

    # ── Stock query ──
    has_stock_phrase = any(p in norm for p in _STOCK_QUERY_PHRASES)

    # ── Price query ──
    if any(p in norm for p in _PRICE_QUERY_PHRASES):
        intent.needs_price_info = True

    # ── Discounts query ──
    if any(p in norm for p in _DISCOUNT_PHRASES):
        intent.needs_discounts = True

    # ── Hablar con humano ──
    if any(p in norm for p in _HUMAN_PHRASES):
        intent.wants_human = True

    # ── Avanzar / comprar ──
    if any(p in norm for p in _PROCEED_PHRASES):
        intent.wants_to_proceed = True

    # ── Product queries: extraemos sustantivos de productos del mensaje ──
    # Tokenizamos y filtramos solo las palabras que están en _PRODUCT_NOUNS
    tokens = re.findall(r"[a-z0-9]+", norm)
    product_tokens = [t for t in tokens if t in _PRODUCT_NOUNS]

    # Si encontramos sustantivo de producto, armamos query con el sustantivo +
    # los modificadores de color/talle del mensaje.
    if product_tokens:
        # Color y talle como modificadores
        modifiers: list[str] = []
        size_match = _SIZE_PATTERN.search(norm)
        if size_match:
            size_val = size_match.group(1) or size_match.group(2)
            if size_val:
                modifiers.append(size_val)

        # Heurística simple: la query es "<noun> <resto del mensaje>" recortada
        # No queremos solo el noun ("remera"), queremos "remera negra" si la dijo
        # entera. Tomamos hasta 6 palabras alrededor del primer noun.
        first_noun = product_tokens[0]
        try:
            idx = tokens.index(first_noun)
            window = tokens[max(0, idx - 2): idx + 4]
            query = " ".join(window)
        except ValueError:
            query = first_noun

        intent.product_queries.append(query.strip())

        # Si hay stock_phrase Y product_query, marcamos stock check
        # (el cliente claramente está preguntando por disponibilidad de ese producto)
        if has_stock_phrase:
            intent.needs_stock_check = True

    # Si dijo stock_phrase sin nombrar producto pero hay producto en notebook,
    # heredamos el último producto mencionado para el stock check.
    if has_stock_phrase and not intent.product_queries and notebook:
        last_products = notebook.get("interest", {}).get("products_mentioned") or []
        if last_products:
            intent.product_queries.append(last_products[-1])
            intent.needs_stock_check = True

    if not intent.is_empty():
        logger.info(
            f"[intent] product_queries={intent.product_queries} "
            f"stock={intent.needs_stock_check} price={intent.needs_price_info} "
            f"discount={intent.needs_discounts} catalog={intent.needs_catalog_overview} "
            f"human={intent.wants_human} proceed={intent.wants_to_proceed} "
            f"phone={'Y' if intent.detected_phone else 'N'} "
            f"email={'Y' if intent.detected_email else 'N'} "
            f"addr={'Y' if intent.detected_address else 'N'}"
        )

    return intent
