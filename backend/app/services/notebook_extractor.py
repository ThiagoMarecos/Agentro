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
from typing import Any

from openai import OpenAI
from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession

logger = logging.getLogger(__name__)

# Modelo barato para extracción. Si OpenAI lo descontinúa, cambiar acá.
EXTRACTOR_MODEL = "gpt-4o-mini"

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
        clean[section] = payload

    if not clean:
        return None

    # Mergear con el notebook actual (deep-merge selectivo)
    nb = session.get_notebook()
    for section, fields in clean.items():
        current = nb.get(section, {}) or {}
        for key, value in fields.items():
            # Para listas: append-unique en lugar de reemplazo
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

    logger.info(f"[notebook-extractor] applied sections={list(clean.keys())}")
    return clean
