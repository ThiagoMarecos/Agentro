"""
Modo copiloto del agente IA.

Cuando un vendedor humano toma control de una conversación (agent_paused=True),
el agente IA deja de responder automáticamente. Pero el vendedor puede pedir
una SUGERENCIA al agente — que la genere con todo el contexto (historial,
notebook, prefetch de DB) y la devuelva como texto editable. El vendedor la
revisa, edita si quiere, y la envía manualmente.

Reusa todo el pipeline existente:
  - intent_extractor + context_prefetcher (DATOS DISPONIBLES)
  - build_sales_prompt (5 fases del diagrama, reglas clave)
  - History compaction
  - Notebook actual

La diferencia: NO ejecuta tools, NO persiste, NO actualiza notebook,
NO mueve stages. Solo genera texto y lo devuelve.
"""

import json
import logging
import time
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_dynamic_setting, get_settings
from app.models.ai import AIAgent, Conversation, Message
from app.models.customer import Customer
from app.models.sales_session import SalesSession
from app.models.store import Store
from app.services.agent_prompts import build_sales_prompt
from app.services.agent_runtime import (
    HISTORY_COMPACTION_THRESHOLD,
    HISTORY_TAIL_KEEP,
    _build_customer_context,
    _compact_history_if_needed,
    _get_active_lessons,
    _get_agent_config,
    _get_custom_instructions,
    _get_message_history,
    _get_sales_agent,
    _get_store_config,
    _greeting_time_window,
    _get_openai_client,
)
from app.services.context_prefetcher import prefetch as prefetch_context, render_for_prompt
from app.services.intent_extractor import extract as extract_intent

logger = logging.getLogger(__name__)


def suggest_reply(
    db: Session,
    store: Store,
    conversation: Conversation,
    additional_hint: str | None = None,
) -> dict[str, Any]:
    """
    Genera una respuesta sugerida para que el vendedor humano la use.

    Args:
        db: sesión de base de datos
        store: tienda
        conversation: conversación activa
        additional_hint: texto opcional del vendedor con instrucción adicional
                         (ej: "respóndele que sí pero con más detalle de envío")

    Returns:
        {
          "suggestion": str,        # texto sugerido editable
          "model": str,
          "tokens": int,
          "latency_ms": int,
        }
    """
    t0 = time.perf_counter()

    # ── Cargar entidades ──
    session = (
        db.query(SalesSession)
        .filter(SalesSession.conversation_id == conversation.id, SalesSession.status == "active")
        .first()
    )
    if not session:
        return {
            "suggestion": "(No hay sesión de venta activa para esta conversación. Respondé manualmente.)",
            "model": None,
            "tokens": 0,
            "latency_ms": 0,
        }

    customer = None
    if conversation.customer_id:
        customer = db.query(Customer).filter(Customer.id == conversation.customer_id).first()

    # Customer context (reusa helper del runtime)
    customer_context: dict
    if customer:
        # is_new_customer=False — sabemos que ya existe; el helper consulta orders
        customer_context = _build_customer_context(db, customer, is_new_customer=False)
    else:
        customer_context = {
            "is_new": True,
            "has_prior_orders": False,
            "prior_orders_count": 0,
            "last_order_at": None,
            "display_name": "",
        }
    customer_context["time_of_day"] = _greeting_time_window()

    # ── Store config + agent config ──
    store_name, store_config = _get_store_config(db, store.id)
    agent = _get_sales_agent(db, store.id)
    agent_config = _get_agent_config(agent)
    custom_instructions = _get_custom_instructions(agent)
    active_lessons = _get_active_lessons(db, agent)

    # ── History (cronológico) ──
    history = _get_message_history(db, conversation.id, limit=60)
    message_count = len(history)

    # Último mensaje del cliente (sirve como pivot para el intent)
    last_user_message = ""
    for m in reversed(history):
        if m["role"] == "user":
            last_user_message = m["content"]
            break

    # ── Context-First: prefetch ──
    prefetched_block = ""
    try:
        intent = extract_intent(
            user_message=last_user_message,
            conversation_history=history,
            notebook=session.get_notebook(),
        )
        if not intent.is_empty():
            prefetched_ctx = prefetch_context(db, session, intent)
            currency = store_config.get("currency", "USD")
            prefetched_block = render_for_prompt(prefetched_ctx, currency=currency)
    except Exception as exc:
        logger.warning(f"[copilot] prefetch skipped: {exc}")

    # ── Prompt + extra hint ──
    base_prompt = build_sales_prompt(
        store_name=store_name,
        store_config=store_config,
        session=session,
        custom_instructions=custom_instructions,
        message_count=message_count,
        lessons=active_lessons,
        customer_context=customer_context,
        prefetched_block=prefetched_block,
    )

    copilot_addendum = (
        "\n\n## ══════════════════════════════════════"
        "\n## 🎯 MODO COPILOTO — instrucción especial"
        "\n## ══════════════════════════════════════"
        "\n"
        "\nEstás generando una RESPUESTA SUGERIDA para que un vendedor humano la "
        "envíe al cliente (con o sin edición). NO mandes la respuesta — solo "
        "generala. NO llames tools. Devolvé SOLO el texto que el vendedor podría "
        "copiar y pegar como su respuesta."
        "\n"
        "\nEscribí en primera persona como si fueras el vendedor humano. Mantenete "
        "fiel al flujo del diagrama y a las reglas clave. Sé breve, claro y útil."
    )
    if additional_hint:
        copilot_addendum += (
            f"\n\nEl vendedor agregó esta instrucción adicional para tu sugerencia:"
            f'\n"{additional_hint.strip()}"'
        )

    system_prompt = base_prompt + copilot_addendum

    openai_messages: list[dict] = [{"role": "system", "content": system_prompt}]
    compacted_history = _compact_history_if_needed(history, session.get_notebook())
    openai_messages.extend(compacted_history)

    # ── Llamada al LLM (sin tools — es solo composición) ──
    client = _get_openai_client()
    model = agent_config.get("model") or "gpt-4o"
    temperature = agent_config.get("temperature", 0.6)

    try:
        response = client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=temperature,
            # IMPORTANTE: sin tools — es modo composición pura
        )
        suggestion = response.choices[0].message.content or ""
        tokens = int(getattr(response, "usage", None).total_tokens or 0) if getattr(response, "usage", None) else 0
    except Exception as exc:
        logger.error(f"[copilot] LLM call failed: {exc}", exc_info=True)
        return {
            "suggestion": "",
            "error": str(exc),
            "model": model,
            "tokens": 0,
            "latency_ms": int((time.perf_counter() - t0) * 1000),
        }

    elapsed_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        f"[copilot] suggested reply for conv={conversation.id[:8]} "
        f"model={model} tokens={tokens} {elapsed_ms}ms"
    )

    return {
        "suggestion": suggestion.strip(),
        "model": model,
        "tokens": tokens,
        "latency_ms": elapsed_ms,
    }
