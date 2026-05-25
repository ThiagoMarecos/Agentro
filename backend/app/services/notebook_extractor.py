"""
Notebook auto-extractor: después de cada turno del agente, hace una llamada
barata a un modelo chico (gpt-4o-mini) para extraer información estructurada
del último intercambio (mensaje del cliente + respuesta del agente) y la
mergea en el notebook de la SalesSession.

Diseñado para ser TOLERANTE A FALLOS: si la extracción falla, no rompe el
flujo del turno principal — solo loggea y sigue.
"""

import json
import logging
import re
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession

logger = logging.getLogger(__name__)

# Mensajes triviales que NO ameritan llamar al LLM-mini (saludos, sí/no, etc).
# Duplicado local del patrón de intent_extractor para evitar dependencia cruzada.
_PRE_TURN_TRIVIAL_PATTERN = re.compile(
    r"^\s*(?:hola|buenas|buen\s*dia|buenas\s*tardes|buenas\s*noches|"
    r"gracias|muchas\s*gracias|ok|dale|si|sí|no|bye|chau|adios|adiós|"
    r"perfecto|listo|genial|excelente|barbaro|bárbaro)[\s!.\?]*$",
    re.IGNORECASE,
)

# Modelo barato para extracción. Si OpenAI lo descontinúa, cambiar acá.
EXTRACTOR_MODEL = "gpt-4o-mini"


# Palabras genéricas que el LLM agrega y "ensucian" la deduplicación
# (ej: "shorts FLEX-01" y "FLEX-01" son el MISMO producto).
_GENERIC_PRODUCT_PREFIXES = (
    "short ", "shorts ", "remera ", "remeras ", "tee ", "camiseta ", "camisetas ",
    "hoodie ", "hoodies ", "jogger ", "joggers ", "pant ", "pants ", "pantalón ",
    "pantalones ", "producto ", "el ", "la ", "los ", "las ", "un ", "una ",
)


def _normalize_list_item(value) -> str:
    """
    Normaliza un item de lista para deduplicación inteligente.
    "FLEX-01", "flex-01", "shorts FLEX-01" → todos retornan "flex-01".
    """
    if not isinstance(value, str):
        return ""
    s = value.strip().lower()
    # quitar prefijos genéricos repetidamente (por si hay anidados)
    changed = True
    while changed:
        changed = False
        for p in _GENERIC_PRODUCT_PREFIXES:
            if s.startswith(p):
                s = s[len(p):]
                changed = True
                break
    # colapsar espacios y normalizar separadores
    s = " ".join(s.split())
    return s

# Secciones válidas del notebook (debe coincidir con sales_session.EMPTY_NOTEBOOK)
_VALID_SECTIONS = {
    "customer", "intent", "interest", "recommendation",
    "pricing", "availability", "shipping", "payment", "order",
}

_EXTRACT_PROMPT = """Sos un extractor de datos. Recibís el último intercambio entre un cliente y un asesor de ventas.
Tu trabajo: extraer información factual del cliente y devolverla como JSON para actualizar la memoria del agente.

Devolvé SOLO un objeto JSON con secciones a actualizar. Cada sección es opcional — incluí solo las que tengan info nueva.

Secciones válidas (usá EXACTAMENTE estos nombres):
- customer: { name, email, phone, preferences (array) }
- intent: { detected (string), keywords (array) }
- interest: { products_mentioned (array), categories (array), budget_range }
- shipping: { address, city, method }
- payment: { method, status }
- order: { order_id, items (array), total }

REGLAS:
1. Si el cliente menciona su nombre por primera vez → customer.name
2. Si menciona un producto específico por nombre → interest.products_mentioned (append, no reemplaces)
3. Si dio dirección/ciudad → shipping.address / shipping.city
4. Si confirmó forma de pago → payment.method
5. Si NO hay información nueva clara → devolvé {}
6. NO inventes datos. Solo lo que está literal en el mensaje.

EJEMPLO INPUT:
Cliente: "Hola, soy Juan. Quiero la remera negra talle M"
Asesor: "¡Hola Juan! Te confirmo, tenemos la remera negra en M."

EJEMPLO OUTPUT:
{"customer": {"name": "Juan"}, "interest": {"products_mentioned": ["remera negra"]}}

Respondé SOLO con el JSON. Nada más."""


def extract_and_apply(
    db: Session,
    session: SalesSession,
    user_message: str,
    assistant_message: str,
    openai_client: OpenAI,
) -> dict[str, Any] | None:
    """
    Llama al extractor con el último intercambio. Mergea las secciones devueltas
    al notebook de la session y persiste. Retorna el dict aplicado o None si
    falló o no había nada que actualizar.

    Costo estimado: ~150-300 tokens de input + ~50 de output con gpt-4o-mini.
    """
    if not user_message and not assistant_message:
        return None

    payload = (
        f"Cliente: {user_message[:600]}\n"
        f"Asesor: {assistant_message[:600]}"
    )

    try:
        response = openai_client.chat.completions.create(
            model=EXTRACTOR_MODEL,
            messages=[
                {"role": "system", "content": _EXTRACT_PROMPT},
                {"role": "user", "content": payload},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=300,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"[notebook-extractor] invalid JSON from LLM: {e}")
        return None
    except Exception as e:
        logger.warning(f"[notebook-extractor] extraction failed: {e}")
        return None

    if not isinstance(data, dict) or not data:
        return None

    # Filtrar secciones inválidas
    clean: dict[str, dict] = {}
    for section, payload in data.items():
        if section not in _VALID_SECTIONS or not isinstance(payload, dict):
            continue
        # BLACKLIST: la sección "order" la maneja SOLO el LLM principal vía
        # update_notebook + el cart-sync que parsea resúmenes. Si el extractor
        # post-turn la tocara, podría contaminar el carrito con strings sueltos
        # u objetos malformados (bug visto: ["dict", "dict", "string", "string"]).
        if section == "order":
            continue
        # Dentro de "interest": el campo "products_mentioned" lo deja crecer
        # libre (es informativo), pero hay que evitar items vacíos / dups.
        clean[section] = payload

    if not clean:
        return None

    # Mergear con el notebook actual (deep-merge selectivo)
    nb = session.get_notebook()
    for section, fields in clean.items():
        current = nb.get(section, {}) or {}
        for key, value in fields.items():
            # Para listas: append-unique con normalización inteligente.
            # Esto evita duplicados feos tipo:
            #   ["FLEX-01", "flex-01", "shorts FLEX-01", "short flex-01"]
            # cuando todos refieren al mismo producto. Normalizamos a
            # lowercase + sin espacios extra + sin prefijos genéricos
            # ("short", "remera", "tee", etc) para deduplicar.
            if isinstance(value, list) and isinstance(current.get(key), list):
                merged = list(current[key])
                seen_norm = {_normalize_list_item(x) for x in merged}
                for item in value:
                    if not item:
                        continue
                    norm = _normalize_list_item(item)
                    if norm and norm not in seen_norm:
                        merged.append(item)
                        seen_norm.add(norm)
                # Si es products_mentioned y crece mucho, quedarse con los últimos N
                if key == "products_mentioned" and len(merged) > 8:
                    merged = merged[-8:]
                current[key] = merged
            elif value not in (None, "", [], {}):
                current[key] = value
        nb[section] = current

    session.set_notebook(nb)
    db.add(session)
    db.commit()

    logger.info(f"[notebook-extractor] applied sections={list(clean.keys())}")
    return clean


# ════════════════════════════════════════════════════════════════════
#  PRE-TURN extractor: corre ANTES de que el LLM construya el prompt
# ════════════════════════════════════════════════════════════════════

_PRE_TURN_EXTRACT_PROMPT = """Sos un extractor de datos personales del cliente.
Recibís SOLO el mensaje del cliente (sin respuesta del asesor). Extraé únicamente
datos personales/de contacto que el cliente acabe de dar en su mensaje.

Devolvé SOLO un objeto JSON con las secciones que correspondan. Cada sección es
opcional — incluí solo si el cliente acaba de mencionar el dato.

Secciones válidas (usá EXACTAMENTE estos nombres):
- customer: { name, email, phone }
- shipping: { address, city }

REGLAS:
1. Si el cliente menciona su nombre (ej: "soy Juan", "me llamo María") → customer.name
2. Si dice un email → customer.email
3. Si dice un teléfono / número de contacto → customer.phone
4. Si da una dirección de envío → shipping.address
5. Si da una ciudad → shipping.city
6. Si NO hay datos personales claros → devolvé {}
7. NO inventes. Solo lo que está literal en el mensaje del cliente.

Respondé SOLO con el JSON. Nada más."""


def extract_and_apply_pre_turn(
    db: Session,
    session: SalesSession,
    user_message: str,
    openai_client: OpenAI,
) -> dict[str, Any] | None:
    """
    Variante PRE-TURN del extractor: corre antes de construir el prompt del
    LLM principal para que el notebook ya tenga los datos personales que el
    cliente acaba de mencionar en este mensaje (nombre, dirección, teléfono).

    Solo recibe el user_message (no hay assistant_message todavía).
    Tolerante a fallo silencioso: cualquier error → log warning y return None,
    nunca rompe el turn.
    """
    if not user_message or not user_message.strip():
        return None

    # Skip mensajes triviales (saludos, ok, gracias) — no traen datos personales
    # y solo queman tokens.
    if _PRE_TURN_TRIVIAL_PATTERN.match(user_message.strip()):
        return None

    payload = f"Cliente: {user_message[:600]}"

    try:
        response = openai_client.chat.completions.create(
            model=EXTRACTOR_MODEL,
            messages=[
                {"role": "system", "content": _PRE_TURN_EXTRACT_PROMPT},
                {"role": "user", "content": payload},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=200,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"[notebook-extractor:pre] invalid JSON from LLM: {e}")
        return None
    except Exception as e:
        logger.warning(f"[notebook-extractor:pre] extraction failed: {e}")
        return None

    if not isinstance(data, dict) or not data:
        return None

    # Filtrar secciones inválidas (solo customer/shipping en pre-turn)
    allowed_pre_turn = {"customer", "shipping"}
    clean: dict[str, dict] = {}
    for section, fields in data.items():
        if section not in allowed_pre_turn or not isinstance(fields, dict):
            continue
        clean[section] = fields

    if not clean:
        return None

    # Mergear con el notebook actual (mismo deep-merge que el post-turn)
    try:
        nb = session.get_notebook()
        for section, fields in clean.items():
            current = nb.get(section, {}) or {}
            for key, value in fields.items():
                if isinstance(value, list) and isinstance(current.get(key), list):
                    merged = list(current[key])
                    for item in value:
                        if item and item not in merged:
                            merged.append(item)
                    current[key] = merged
                elif value not in (None, "", [], {}):
                    current[key] = value
            nb[section] = current

        session.set_notebook(nb)
        db.add(session)
        db.commit()
    except Exception as e:
        logger.warning(f"[notebook-extractor:pre] merge/persist failed: {e}")
        return None

    logger.info(f"[notebook-extractor:pre] applied sections={list(clean.keys())}")
    return clean


# ════════════════════════════════════════════════════════════════════
#  CART SYNC: safety net — si el agente armó un resumen pero NO llamó
#  update_notebook, parseamos los items del texto y los guardamos igual.
# ════════════════════════════════════════════════════════════════════

# Señales FUERTES de que el agente está armando un resumen real con datos.
# Ojo: regex anterior matcheaba con "pedido" suelto, lo cual disparaba el sync
# en mensajes de cierre tipo "te paso con un asesor que cerrará el pedido" —
# y el LLM-mini inventaba items contaminando el carrito.
# Ahora pedimos: (subtotal O total con $) Y al menos un signo de pesos/precio.
_CART_SUMMARY_SIGNALS = re.compile(
    r"(subtotal\s*:?\s*\$?|total\s*:?\s*\$\s*\d|"
    r"resumen\s+(de\s+)?(tu\s+)?(pedido|compra|propuesta)|"
    r"productos\s+confirmados)",
    re.IGNORECASE,
)
_PRICE_LIKE = re.compile(r"\$?\s*\d{1,3}([.,]\d{3})+\s*(pyg|usd|ars|gs|brl|clp|mxn|eur)?", re.IGNORECASE)

# Anti-señales: si el mensaje tiene CUALQUIERA de estas frases, NO ejecutar
# el cart-sync (son mensajes de cierre/handoff donde "pedido" aparece como
# referencia pero NO hay items que extraer).
_CART_SKIP_SIGNALS = re.compile(
    r"(te\s+paso\s+con|asesor\s+que|pasarte\s+con|"
    r"te\s+contactar[áa]|te\s+escribir[áa]|"
    r"derivo\s+(con|al?\s+vendedor)|"
    r"un\s+(asesor|vendedor|humano|representante)\s+(te|va|se|cerrar))",
    re.IGNORECASE,
)

_CART_EXTRACT_PROMPT = """Sos un parser de carritos de compra.

Recibís un mensaje que un asesor de ventas le acaba de mandar a un cliente.
Tu trabajo: si el mensaje contiene un RESUMEN DE PEDIDO o LISTA DE PRODUCTOS
CONFIRMADOS (con precios), extraer cada item como JSON estructurado.

Devolvé SOLO un JSON con esta forma:
{
  "items": [
    {"name": "<nombre EXACTO del producto>", "variant_name": "<talle/color o null>",
     "quantity": <int>, "unit_price": <número o null>}
  ]
}

Si el mensaje NO contiene un resumen / lista de productos con precios, devolvé `{"items": []}`.

REGLAS CRÍTICAS:
1. Solo extraé productos que el asesor está PRESENTANDO como confirmados o
   incluidos en el pedido (líneas con bullets/números/precios/talles).
2. NO extraés productos que el asesor SOLO menciona / recomienda / pregunta
   si le interesan. Solo los que están en el resumen final.
3. **TALLE/COLOR COMPARTIDO**: si el asesor dice "ambos en talle S" o
   "los dos en talle M" o "ambos en color azul", el variant_name de TODOS
   los items extraídos debe ser ese talle/color.
4. **NOMBRE EXACTO**: copiá el nombre del producto tal cual aparece en el
   mensaje. Si dice "COMPRESS-01 TEE", devolvé "COMPRESS-01 TEE" (no "TEE").
5. Si un item no tiene talle/cantidad/precio explícito, dejá esos campos
   como null o 1 para quantity por defecto.
6. NO inventes productos. Si dudás si algo es un producto real o solo
   una mención casual, NO lo incluyas (mejor `[]` que items inventados).
7. Si el mensaje es un cierre/handoff ("te paso con un asesor") devolvé `[]`.

EJEMPLO 1:
INPUT: "He preparado un combo con la remera **COMPRESS-01 TEE** y el short
**FLEX-01**, ambos en talle S. Subtotal: 750,000 PYG"
OUTPUT: {"items": [
  {"name": "COMPRESS-01 TEE", "variant_name": "S", "quantity": 1, "unit_price": null},
  {"name": "FLEX-01", "variant_name": "S", "quantity": 1, "unit_price": null}
]}

EJEMPLO 2:
INPUT: "Listo, Javier. Te paso con un asesor que cerrará el pedido."
OUTPUT: {"items": []}

EJEMPLO 3:
INPUT: "Tengo el FLEX-01 a 350,000 PYG. ¿Te interesa? ¿Querés ver fotos?"
OUTPUT: {"items": []}    (esto es recomendación, no resumen)

Respondé SOLO con el JSON. Nada más."""


def sync_cart_from_assistant_message(
    db: Session,
    session: SalesSession,
    assistant_message: str,
    openai_client: OpenAI,
) -> dict[str, Any] | None:
    """
    Safety net del carrito: si el asistente armó un resumen de pedido en su
    respuesta pero NO llamó `update_notebook(section='order')`, este extractor
    parsea los items mencionados en el texto y los guarda en el notebook.

    Solo dispara si:
      - El texto del asistente contiene señales de "resumen"/"pedido"/"carrito"
      - El carrito actual del notebook está vacío O tiene menos items que los
        que aparecen en el texto

    Matchea cada item por NOMBRE contra los productos reales de la tienda
    (filtrando por store_id). Si no matchea ningún producto real, no agrega.

    Tolerante a fallo silencioso.
    """
    if not assistant_message or not assistant_message.strip():
        return None

    # Skip si el mensaje es claramente un cierre/handoff con frases tipo
    # "te paso con un asesor" — esos mensajes mencionan "pedido" pero NO
    # contienen items que extraer, y el LLM-mini puede inventar y contaminar.
    if _CART_SKIP_SIGNALS.search(assistant_message):
        logger.info("[cart-sync] skip: detectado mensaje de cierre/handoff")
        return None

    # Solo disparar si hay señales FUERTES de resumen real (subtotal/total con $,
    # o "resumen de pedido/compra/propuesta", o "productos confirmados")
    # ADEMÁS requiere al menos UN precio reconocible en el texto (sino no es un resumen real).
    if not _CART_SUMMARY_SIGNALS.search(assistant_message):
        return None
    if not _PRICE_LIKE.search(assistant_message):
        logger.info("[cart-sync] skip: tiene señal de resumen pero sin precios reconocibles")
        return None

    # Llamar al LLM-mini para extraer items estructurados
    try:
        response = openai_client.chat.completions.create(
            model=EXTRACTOR_MODEL,
            messages=[
                {"role": "system", "content": _CART_EXTRACT_PROMPT},
                {"role": "user", "content": assistant_message[:2000]},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=500,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning(f"[cart-sync] invalid JSON from LLM: {e}")
        return None
    except Exception as e:
        logger.warning(f"[cart-sync] extraction failed: {e}")
        return None

    extracted_items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(extracted_items, list) or not extracted_items:
        return None

    # Matchear contra productos reales de la tienda
    from app.models.product import Product, ProductVariant
    from sqlalchemy import func as sa_func

    matched_items: list[dict] = []
    for it in extracted_items:
        if not isinstance(it, dict):
            continue
        name = (it.get("name") or "").strip()
        if not name:
            continue

        # Match case-insensitive por nombre, filtrado por store
        product = db.query(Product).filter(
            Product.store_id == session.store_id,
            Product.is_active == True,
            sa_func.lower(Product.name) == name.lower(),
        ).first()

        # Fallback: match parcial si no encontró exacto
        if not product:
            product = db.query(Product).filter(
                Product.store_id == session.store_id,
                Product.is_active == True,
                Product.name.ilike(f"%{name}%"),
            ).first()

        if not product:
            logger.info(f"[cart-sync] item '{name}' no matcheó ningún producto real — skip")
            continue

        # Resolver variant_id si hay variant_name
        variant_id = None
        variant_name = (it.get("variant_name") or "").strip() or None
        if variant_name:
            variant = db.query(ProductVariant).filter(
                ProductVariant.product_id == product.id,
                ProductVariant.is_active == True,
                sa_func.lower(ProductVariant.name) == variant_name.lower(),
            ).first()
            if variant:
                variant_id = variant.id

        # Resolver unit_price: si el LLM dio uno usar ese; si no, el del producto
        unit_price = it.get("unit_price")
        if unit_price is None or unit_price == 0:
            unit_price = float(product.price or 0)

        try:
            qty = int(it.get("quantity") or 1)
        except (TypeError, ValueError):
            qty = 1

        matched_items.append({
            "product_id": product.id,
            "name": product.name,
            "variant_id": variant_id,
            "variant_name": variant_name,
            "quantity": qty,
            "unit_price": unit_price,
        })

    if not matched_items:
        return None

    # Mergear con el carrito actual del notebook
    try:
        nb = session.get_notebook()
        order_section = nb.get("order") or {}
        if not isinstance(order_section, dict):
            order_section = {}
        existing_items = order_section.get("items") or []
        if not isinstance(existing_items, list):
            existing_items = []

        # PROTECCIÓN ANTI-CORRUPCIÓN: si el carrito ya tiene items con product_id,
        # solo reemplazamos si los NUEVOS items contienen TODOS los product_ids
        # que ya teníamos (es decir, el agente está mostrando un resumen extendido
        # o igual, no reemplazándolos por otros). Esto previene el bug donde el
        # cart-sync extrae items inventados/equivocados y pisa los reales.
        existing_pids = {
            it.get("product_id") for it in existing_items
            if isinstance(it, dict) and it.get("product_id")
        }
        new_pids = {
            it.get("product_id") for it in matched_items
            if isinstance(it, dict) and it.get("product_id")
        }

        if existing_pids and not existing_pids.issubset(new_pids):
            missing = existing_pids - new_pids
            logger.info(
                f"[cart-sync] SKIP: los items nuevos NO contienen los product_ids "
                f"ya existentes (faltan {len(missing)}). Carrito actual se mantiene "
                f"intacto para evitar corrupción."
            )
            return None

        # Si el carrito está vacío, o si los nuevos contienen a los existentes
        # (extensión legítima): aplicar el merge.
        if len(matched_items) >= len(existing_items):
            order_section["items"] = matched_items
            nb["order"] = order_section
            session.set_notebook(nb)
            db.add(session)
            db.commit()
            logger.info(
                f"[cart-sync] cart updated from assistant message: "
                f"{len(existing_items)} → {len(matched_items)} items"
            )
            return {"order": {"items": matched_items}}
        else:
            logger.info(
                f"[cart-sync] extracted {len(matched_items)} items but cart already "
                f"has {len(existing_items)} — skip (probably partial message)"
            )
    except Exception as e:
        logger.warning(f"[cart-sync] merge/persist failed: {e}")
        return None

    return None
