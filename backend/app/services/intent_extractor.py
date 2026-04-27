"""
Intent Extractor — analiza el mensaje del cliente y devuelve qué necesita
consultarse en la DB ANTES de llamar al LLM.

Es la primera mitad de la arquitectura "Context-First": en vez de dejar
que el LLM decida cuándo llamar tools (probabilístico), este módulo
escanea el mensaje y le dice al `context_prefetcher` qué traer.

Diseño 100% DINÁMICO:
  - NO hay diccionarios hardcoded de productos ni sinónimos.
  - La detección de productos se hace via LLM (gpt-4o-mini) que lee
    el CATÁLOGO REAL de la tienda en cada turno y decide qué buscar.
  - Solo lo que es UNIVERSAL queda como regex/heurística:
      * Datos personales (phone, email, address) — formato común
      * Flags de intención (pidió humano, quiere avanzar, descuento)
      * Pedido de catálogo overview ("qué tienen?", "qué venden?")

  Ventaja: la misma lógica funciona igual de bien para una tienda de
  ropa que para una de productos veterinarios, ferretería, comida o
  cualquier rubro — sin tocar código.
"""

import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Intent:
    """Resultado del intent extractor — instrucciones para el prefetcher."""

    # Términos a buscar como productos en la DB. Se llenan via LLM-mini
    # con el catálogo real de la tienda (NO desde un diccionario hardcoded).
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
#  Patrones UNIVERSALES (no dependen del rubro de la tienda)
# ════════════════════════════════════════════════════════════════════

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
#  Tier 1 — Detección rápida de flags + datos personales
#  (NO detecta productos — eso lo hace el Tier 2 con LLM)
# ════════════════════════════════════════════════════════════════════

def extract(
    user_message: str,
    conversation_history: list[dict] | None = None,
    notebook: dict | None = None,
) -> Intent:
    """
    Detección rápida regex/heurística. SOLO universal:
      - Datos personales (phone, email, address)
      - Flags de intención (catálogo, stock, precio, descuento, humano, comprar)

    NO detecta productos — eso lo hace `extract_product_terms()` con LLM
    leyendo el catálogo real de la tienda.
    """
    intent = Intent()
    if not user_message:
        return intent

    raw = user_message
    norm = _normalize(user_message)
    intent.normalized = norm

    # ── Datos personales ──
    phone_match = _PHONE_PATTERN.search(raw)
    if phone_match:
        candidate = phone_match.group(0).strip()
        digits_only = re.sub(r"[^\d]", "", candidate)
        if 10 <= len(digits_only) <= 13:
            intent.detected_phone = candidate

    email_match = _EMAIL_PATTERN.search(raw)
    if email_match:
        intent.detected_email = email_match.group(0)

    address_match = _ADDRESS_PATTERN.search(raw)
    if address_match:
        intent.detected_address = address_match.group(0)

    # ── Flags de intención ──
    if any(p in norm for p in _CATALOG_OVERVIEW_PHRASES):
        intent.needs_catalog_overview = True
    if any(p in norm for p in _STOCK_QUERY_PHRASES):
        intent.needs_stock_check = True
    if any(p in norm for p in _PRICE_QUERY_PHRASES):
        intent.needs_price_info = True
    if any(p in norm for p in _DISCOUNT_PHRASES):
        intent.needs_discounts = True
    if any(p in norm for p in _HUMAN_PHRASES):
        intent.wants_human = True
    if any(p in norm for p in _PROCEED_PHRASES):
        intent.wants_to_proceed = True

    if not intent.is_empty():
        logger.info(
            f"[intent-tier1] flags: stock={intent.needs_stock_check} "
            f"price={intent.needs_price_info} discount={intent.needs_discounts} "
            f"catalog={intent.needs_catalog_overview} human={intent.wants_human} "
            f"proceed={intent.wants_to_proceed} "
            f"phone={'Y' if intent.detected_phone else 'N'} "
            f"email={'Y' if intent.detected_email else 'N'} "
            f"addr={'Y' if intent.detected_address else 'N'}"
        )

    return intent


# ════════════════════════════════════════════════════════════════════
#  Tier 2 — Detección de productos via LLM con catálogo real
# ════════════════════════════════════════════════════════════════════

# Regex que matchea mensajes "triviales" — saludos, agradecimientos, sí/no
# cortos. Para esos, no llamamos al LLM-mini (no agrega valor y quema tokens).
_TRIVIAL_MESSAGE_PATTERN = re.compile(
    r"^\s*(?:hola|buenas|buen\s*dia|buenas\s*tardes|buenas\s*noches|"
    r"gracias|muchas\s*gracias|ok|dale|si|sí|no|bye|chau|adios|adiós|"
    r"perfecto|listo|genial|excelente|barbaro|bárbaro)[\s!.\?]*$",
    re.IGNORECASE,
)


_PRODUCT_EXTRACTION_PROMPT = """Sos un extractor de intent de compra para un e-commerce.

Recibís el mensaje de un cliente Y el catálogo real de la tienda (categorías
+ productos destacados). Tu trabajo: extraer 1-3 search terms que se
puedan usar para buscar productos en ESA tienda específicamente.

REGLAS:
1. Mirá el catálogo real. Devolvé términos que tengan match razonable con
   los productos / categorías reales. NO inventes categorías que no estén.
2. Si el cliente usa palabras regionales (abrigo, hoodie, buzo, canguro,
   campera, sweater), traducí a las palabras que mejor matcheen el catálogo
   de ESTA tienda.
3. Si el cliente describe un USO ("para entrenar", "para frío", "para mi
   perro", "para regalo"), inferí qué tipo de producto le sirve y devolvé
   ese término según lo que la tienda vende.
4. Si el cliente nombra varios productos en un mensaje ("remera negra y
   shorts"), devolvé un término por cada uno.
5. Si el cliente NO está buscando producto sino preguntando otra cosa
   (saludo, horarios, contacto, queja, dato personal), devolvé `[]`.

Respondé SOLO un JSON con este formato:
{
  "search_terms": ["término 1", "término 2"],
  "reasoning": "explicación corta"
}

EJEMPLOS GENÉRICOS:
- Cliente: "necesito algo para entrenar"
  → search_terms basados en lo que la tienda vende (ropa deportiva, equipamiento...)

- Cliente: "tenés algo para el frío?"
  → search_terms de abrigos según el catálogo

- Cliente: "hola que tal"
  → search_terms: []  (saludo, sin intent de compra)

- Cliente: "remera negra y zapatillas blancas"
  → search_terms: ["remera negra", "zapatillas blancas"]"""


def extract_product_terms(
    db,
    session,
    user_message: str,
    openai_client,
) -> list[str]:
    """
    Detección DINÁMICA de productos. Llama a gpt-4o-mini con el catálogo
    real de la tienda y le pide que traduzca el mensaje del cliente en
    search terms contextuales.

    No depende de diccionarios hardcoded — el "diccionario" es el catálogo
    real de la tienda en este momento.

    Costo: ~300-600 tokens input + ~80 output con gpt-4o-mini → centavos
    por mensaje. Tolerante a fallos.
    """
    if not user_message:
        return []

    # Skip mensajes triviales (saludos, agradecimientos, "ok") — no agregan
    # valor llamar al LLM y queman tokens.
    if _TRIVIAL_MESSAGE_PATTERN.match(user_message.strip()):
        return []

    # Cargar catálogo de la tienda
    from app.models.product import Product, Category
    from sqlalchemy import desc

    cats = (
        db.query(Category)
        .filter(Category.store_id == session.store_id, Category.is_active == True)
        .order_by(Category.sort_order.asc())
        .limit(25)
        .all()
    )
    category_names = [c.name for c in cats]

    # Top 30 productos representativos del catálogo
    sample_products = (
        db.query(Product)
        .filter(
            Product.store_id == session.store_id,
            Product.is_active == True,
            Product.status == "active",
        )
        .order_by(Product.is_featured.desc().nullslast(), desc(Product.created_at))
        .limit(30)
        .all()
    )

    if not category_names and not sample_products:
        # Tienda sin productos cargados — no hay catálogo donde buscar
        return []

    product_lines = []
    for p in sample_products:
        cat = p.category.name if p.category else "—"
        product_lines.append(f"- {p.name} ({cat})")

    catalog_block = (
        f"CATEGORÍAS ({len(category_names)}):\n"
        + ("\n".join(f"- {n}" for n in category_names) if category_names else "(sin categorías)")
        + f"\n\nPRODUCTOS DE LA TIENDA ({len(product_lines)}):\n"
        + ("\n".join(product_lines) if product_lines else "(sin productos)")
    )

    payload = (
        f"MENSAJE DEL CLIENTE:\n{user_message[:600]}\n\n"
        f"CATÁLOGO REAL DE ESTA TIENDA:\n{catalog_block}"
    )

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _PRODUCT_EXTRACTION_PROMPT},
                {"role": "user", "content": payload},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=200,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as exc:
        logger.warning(f"[intent-tier2] LLM extraction failed: {exc}")
        return []

    terms = data.get("search_terms") or []
    if not isinstance(terms, list):
        return []

    # Sanitización
    cleaned: list[str] = []
    seen: set[str] = set()
    for t in terms:
        if not isinstance(t, str):
            continue
        t = t.strip().lower()
        if 2 <= len(t) <= 80 and t not in seen:
            seen.add(t)
            cleaned.append(t)
        if len(cleaned) >= 3:
            break

    if cleaned:
        logger.info(
            f"[intent-tier2] dynamic terms={cleaned} "
            f"reasoning={(data.get('reasoning', '') or '')[:120]!r}"
        )
    return cleaned
