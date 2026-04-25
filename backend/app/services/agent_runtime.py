"""
AgentRuntime: orquesta el flujo completo de un mensaje de chat.
1. Busca/crea Customer, Conversation, SalesSession
2. Carga contexto de la tienda
3. Construye el prompt maestro de ventas
4. Llama OpenAI con function calling
5. Ejecuta tools en loop
6. Persiste mensajes y notebook
"""

import json
import logging
import time
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings, get_dynamic_setting
from app.models.ai import Conversation, Message, AIAgent, AgentLesson
from app.models.customer import Customer
from app.models.order import Order
from app.models.store import Store
from app.models.sales_session import SalesSession, EMPTY_NOTEBOOK
from app.services.agent_tools import get_tools_for_agent, TOOL_EXECUTORS
from app.services.agent_prompts import build_sales_prompt
from app.services.context_prefetcher import prefetch as prefetch_context, render_for_prompt
from app.services.intent_extractor import extract as extract_intent
from app.services.platform_settings_service import get_setting_value

logger = logging.getLogger(__name__)

# Un turno de venta completo puede usar muchas tools encadenadas:
# list_categories → product_search → product_detail → check_availability →
# send_product_image → update_notebook → move_stage → estimate_shipping →
# create_payment_link → create_order. 16 deja margen para reintentos y búsquedas
# alternativas sin cortar el flujo a la mitad.
MAX_TOOL_ITERATIONS = 16

# Si el historial supera este umbral, se compacta usando notebook + últimos N msgs
HISTORY_COMPACTION_THRESHOLD = 24
HISTORY_TAIL_KEEP = 10


def _get_openai_client() -> OpenAI:
    api_key = get_dynamic_setting("openai_api_key")
    if not api_key:
        raise ValueError("OPENAI_API_KEY no configurada en el servidor.")
    return OpenAI(api_key=api_key)


def _find_or_create_customer(
    db: Session, store_id: str, identifier: str
) -> tuple[Customer, bool]:
    """Busca o crea un customer por email o teléfono. Retorna (customer, is_new)."""
    is_email = "@" in identifier

    if is_email:
        customer = db.query(Customer).filter(
            Customer.store_id == store_id,
            Customer.email == identifier,
        ).first()
    else:
        customer = db.query(Customer).filter(
            Customer.store_id == store_id,
            Customer.phone == identifier,
        ).first()

    if customer:
        return customer, False

    customer = Customer(
        store_id=store_id,
        email=identifier if is_email else f"{identifier}@chat.agentro.app",
        phone=identifier if not is_email else None,
        first_name="",
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer, True


def _build_customer_context(db: Session, customer: Customer, is_new_customer: bool) -> dict:
    """
    Información de contexto del cliente para personalizar el saludo y la conversación.
    - is_new: nunca antes vio la tienda (acabamos de crearlo en esta llamada)
    - has_prior_orders: ya compró antes
    - prior_orders_count: cantidad
    - last_order_at: timestamp de la última orden (puede usarse para "¡cuánto tiempo!")
    """
    if is_new_customer:
        return {
            "is_new": True,
            "has_prior_orders": False,
            "prior_orders_count": 0,
            "last_order_at": None,
            "display_name": "",
        }

    orders_count = db.query(func.count(Order.id)).filter(
        Order.customer_id == customer.id,
        Order.status.in_(["confirmed", "processing", "shipped", "delivered"]),
    ).scalar() or 0

    last_order = db.query(Order.created_at).filter(
        Order.customer_id == customer.id,
    ).order_by(Order.created_at.desc()).first()

    return {
        "is_new": False,
        "has_prior_orders": orders_count > 0,
        "prior_orders_count": orders_count,
        "last_order_at": last_order[0].isoformat() if last_order and last_order[0] else None,
        "display_name": (customer.first_name or "").strip(),
    }


def _greeting_time_window(language: str = "es") -> str:
    """Devuelve 'mañana' / 'tarde' / 'noche' según hora local del servidor."""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "mañana"
    if 12 <= hour < 19:
        return "tarde"
    return "noche"


def _find_or_create_conversation(
    db: Session, store_id: str, customer_id: str, channel_type: str
) -> Conversation:
    """Busca conversación activa o crea nueva."""
    conv = db.query(Conversation).filter(
        Conversation.store_id == store_id,
        Conversation.customer_id == customer_id,
        Conversation.status == "active",
    ).first()

    if not conv:
        conv = Conversation(
            store_id=store_id,
            customer_id=customer_id,
            channel_type=channel_type,
            status="active",
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    return conv


def _find_or_create_session(
    db: Session, store_id: str, conversation_id: str, customer_id: str
) -> SalesSession:
    """Busca sesión activa o crea nueva con stage=incoming."""
    session = db.query(SalesSession).filter(
        SalesSession.conversation_id == conversation_id,
        SalesSession.status == "active",
    ).first()

    if not session:
        now = datetime.now(timezone.utc)
        session = SalesSession(
            store_id=store_id,
            conversation_id=conversation_id,
            customer_id=customer_id,
            current_stage="incoming",
            status="active",
            started_at=now,
            stage_entered_at=now,
            notebook=json.dumps(EMPTY_NOTEBOOK),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    return session


def _get_store_config(db: Session, store_id: str) -> tuple[str, dict]:
    """Obtiene nombre y configuración de la tienda."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        return "Tienda", {}

    return store.name, {
        "currency": store.currency or "USD",
        "language": store.language or "es",
        "country": store.country or "",
        "business_type": store.business_type or "retail",
        "support_phone": store.support_phone or "",
        "support_email": store.support_email or "",
        "industry": store.industry or "",
    }


def _get_sales_agent(db: Session, store_id: str) -> AIAgent | None:
    """
    Obtiene el agente de ventas de la tienda.
    Prioridad:
    1. Agente stage para la etapa actual (legacy)
    2. Agente genérico activo
    3. None (usa defaults)
    """
    # Primero intentar agente genérico (el más común)
    agent = db.query(AIAgent).filter(
        AIAgent.store_id == store_id,
        AIAgent.is_active == True,
    ).order_by(
        # Preferir agentes genéricos sobre stage-specific
        AIAgent.agent_type.asc()
    ).first()

    return agent


def _get_agent_config(agent: AIAgent | None) -> dict:
    """Extrae model, temperature, etc. del agente."""
    settings = get_settings()
    defaults = {
        "model": settings.openai_default_model,
        "temperature": 0.75,  # Balance entre naturalidad y consistencia
    }

    if agent and agent.config:
        try:
            cfg = json.loads(agent.config)
            defaults.update(cfg)
        except (json.JSONDecodeError, TypeError):
            pass

    return defaults


def _get_enabled_tools(agent: AIAgent | None) -> list[str] | None:
    """Parsea la lista de tools habilitadas del agente."""
    if not agent or not agent.enabled_tools:
        return None
    try:
        tools = json.loads(agent.enabled_tools)
        return tools if tools else None
    except (json.JSONDecodeError, TypeError):
        return None


def _get_custom_instructions(agent: AIAgent | None) -> str | None:
    """Obtiene instrucciones personalizadas del agente."""
    if agent and agent.system_prompt:
        return agent.system_prompt
    return None


def _get_active_lessons(db: Session, agent: AIAgent | None) -> list[AgentLesson]:
    """
    Si el agente tiene `learning_mode_enabled=True`, devuelve sus lecciones activas
    ordenadas por prioridad. Caso contrario, lista vacía.
    """
    if not agent or not agent.learning_mode_enabled:
        return []
    return db.query(AgentLesson).filter(
        AgentLesson.agent_id == agent.id,
        AgentLesson.is_active == True,
    ).order_by(
        AgentLesson.priority.asc().nullslast(),
        AgentLesson.created_at.desc(),
    ).all()


def _get_message_history(db: Session, conversation_id: str, limit: int = 60) -> list[dict]:
    """
    Carga los últimos mensajes de la conversación, ordenados cronológicamente.
    Subimos el límite a 60 — la compactación más abajo se encarga de mantener
    el prompt manejable cuando hay muchos turnos.
    """
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
    ).order_by(Message.created_at.desc()).limit(limit).all()
    messages.reverse()  # cronológico

    return [{"role": m.role, "content": m.content} for m in messages]


def _compact_history_if_needed(
    history: list[dict],
    notebook: dict,
) -> list[dict]:
    """
    Si el historial supera HISTORY_COMPACTION_THRESHOLD, comprime los mensajes
    antiguos en un único system "resumen" y deja los últimos HISTORY_TAIL_KEEP
    intactos. El notebook ya cubre la mayoría del contexto factual, así que
    el resumen es solo una guía narrativa muy corta.
    """
    if len(history) <= HISTORY_COMPACTION_THRESHOLD:
        return history

    head = history[:-HISTORY_TAIL_KEEP]
    tail = history[-HISTORY_TAIL_KEEP:]

    # Resumen narrativo MUY corto basado en cuenta y rol
    user_count = sum(1 for m in head if m["role"] == "user")
    assistant_count = sum(1 for m in head if m["role"] == "assistant")

    # Tomamos los primeros 2 mensajes del cliente como pista del tema
    first_user_msgs = [m["content"] for m in head if m["role"] == "user"][:2]
    intent_hint = " | ".join(s[:80] for s in first_user_msgs) or "—"

    summary = (
        f"[RESUMEN DE CONVERSACIÓN PREVIA — {len(head)} mensajes comprimidos]\n"
        f"- Hubo {user_count} mensajes del cliente y {assistant_count} respuestas tuyas.\n"
        f"- Temas iniciales del cliente: {intent_hint}\n"
        f"- Toda la información factual relevante ya está en el NOTEBOOK al final del prompt.\n"
        "- Continuá la conversación normalmente, sin re-preguntar lo que ya está en el notebook."
    )

    return [{"role": "system", "content": summary}, *tail]


def process_message(
    db: Session,
    store_id: str,
    channel: str,
    customer_identifier: str,
    message: str,
    image_b64: str | None = None,
) -> dict:
    """
    Flujo principal:
    1. Customer -> Conversation -> SalesSession
    2. Store config -> Sales prompt
    3. OpenAI (tools loop)
    4. Persist messages + notebook
    5. Return response
    """
    # ── 1. Entidades base ──
    customer, is_new_customer = _find_or_create_customer(db, store_id, customer_identifier)
    conversation = _find_or_create_conversation(db, store_id, customer.id, channel)
    session = _find_or_create_session(db, store_id, conversation.id, customer.id)

    # ── Si un vendedor humano tomó control, el agente no responde ──
    # El mensaje del cliente igual se persiste, pero no generamos respuesta IA.
    # El vendedor lo verá en su inbox y responderá manualmente.
    if conversation.agent_paused:
        try:
            user_msg = Message(
                conversation_id=conversation.id,
                role="user",
                content=message if not image_b64 else f"[Imagen] {message}",
            )
            db.add(user_msg)
            db.commit()
        except Exception as exc:
            logger.warning(f"[agent] could not persist user msg while paused: {exc}")
        logger.info(f"[agent] conversation {conversation.id[:8]} is paused (human control); skipping LLM call")
        return {
            "response": None,  # no enviamos nada al cliente automáticamente
            "pending_media": [],
            "conversation_id": conversation.id,
            "session_id": session.id,
            "stage": session.current_stage,
            "agent_paused": True,
        }

    customer_context = _build_customer_context(db, customer, is_new_customer)
    customer_context["time_of_day"] = _greeting_time_window()

    # Sincronizar datos del customer al notebook
    nb = session.get_notebook()
    if customer.email and "@chat." not in (customer.email or "") and not nb["customer"].get("email"):
        nb["customer"]["email"] = customer.email
    if customer.first_name and not nb["customer"].get("name"):
        nb["customer"]["name"] = customer.first_name
    if customer.phone and not nb["customer"].get("phone"):
        nb["customer"]["phone"] = customer.phone or ""
    session.set_notebook(nb)

    # ── 2. Contexto de la tienda y agente ──
    store_name, store_config = _get_store_config(db, store_id)
    agent = _get_sales_agent(db, store_id)
    agent_config = _get_agent_config(agent)
    custom_instructions = _get_custom_instructions(agent)

    # ── 3. Prompt maestro (versión inicial, se reconstruye después del historial) ──
    system_prompt = ""  # Se construye abajo con message_count

    # Modelo configurable desde platform settings
    model_override = get_setting_value(db, "agent_model")
    if model_override:
        agent_config["model"] = model_override

    # ── 4. Tools ──
    # El agente Agentro v2 es de PRE-VENTA: nunca cierra la venta ni cobra.
    # Las tools de cierre (create_order, create_payment_link) solo están
    # disponibles si el dueño explícitamente las habilita en la config del agente.
    # Por defecto: solo tools de descubrimiento, validación, recopilación y escalamiento.
    enabled_tools = _get_enabled_tools(agent)
    if not enabled_tools:
        enabled_tools = None  # → get_tools_for_agent retorna _DEFAULT_SAFE_TOOLS
    tool_definitions = get_tools_for_agent(enabled_tools)

    # ── 5. Historial + mensaje actual ──
    history = _get_message_history(db, conversation.id)
    message_count = len(history)

    # ── Auto-avanzar etapa si ya hubo saludo previo ──
    # Si la etapa sigue en "incoming" pero ya hay mensajes en el historial,
    # el saludo ya ocurrió. Avanzamos programáticamente para que el agente
    # no vuelva a saludar en cada mensaje.
    if session.current_stage == "incoming" and message_count > 0:
        try:
            from app.services.stage_engine import move_to_stage
            move_to_stage(db, session, "discovery", reason="auto: saludo previo detectado en historial")
            db.refresh(session)
            logger.info(f"Session {session.id[:8]} auto-advanced: incoming → discovery")
        except Exception as e:
            logger.warning(f"Could not auto-advance stage: {e}")

    # Cargar lecciones del modo aprendizaje (si está activo)
    active_lessons = _get_active_lessons(db, agent)

    # ── 5.1. CONTEXT-FIRST: extraer intent + pre-fetch de DB ──
    # En vez de dejar que el LLM decida cuándo llamar tools (probabilístico),
    # escaneamos el mensaje del cliente DETERMINÍSTICAMENTE y pre-cargamos
    # todos los datos relevantes (productos, stock, descuentos, datos personales).
    # El LLM ve esos datos en el system prompt — no tiene cómo inventar.
    prefetched_block = ""
    try:
        intent = extract_intent(
            user_message=message,
            conversation_history=history,
            notebook=session.get_notebook(),
        )
        if not intent.is_empty():
            prefetched_ctx = prefetch_context(db, session, intent)
            currency = store_config.get("currency", "USD")
            prefetched_block = render_for_prompt(prefetched_ctx, currency=currency)
    except Exception as exc:
        # Si el prefetch falla, seguimos con tools como fallback (no rompemos el turno)
        logger.warning(f"[agent] context-first prefetch skipped: {exc}", exc_info=True)
        prefetched_block = ""

    # Reconstruir prompt con la etapa actualizada + lecciones + contexto del cliente + pre-fetch
    system_prompt = build_sales_prompt(
        store_name=store_name,
        store_config=store_config,
        session=session,
        custom_instructions=custom_instructions,
        message_count=message_count,
        lessons=active_lessons,
        customer_context=customer_context,
        prefetched_block=prefetched_block,
    )

    openai_messages = [{"role": "system", "content": system_prompt}]
    compacted_history = _compact_history_if_needed(history, session.get_notebook())
    if len(compacted_history) != len(history):
        logger.info(
            f"[agent] history compacted: {len(history)} → {len(compacted_history)} messages "
            f"for conversation {conversation.id[:8]}"
        )
    openai_messages.extend(compacted_history)

    # Soporte de visión: si se recibió una imagen del cliente, armar mensaje multimodal
    if image_b64:
        user_content = [
            {"type": "text", "text": message},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_b64}",
                    "detail": "low",  # "low" para ahorrar tokens; suficiente para productos
                },
            },
        ]
    else:
        user_content = message

    openai_messages.append({"role": "user", "content": user_content})

    # Persistir mensaje del usuario (solo texto para la BD)
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=message if not image_b64 else f"[Imagen] {message}",
    )
    db.add(user_msg)
    db.commit()

    # ── 6. Llamar OpenAI con tool loop ──
    client = _get_openai_client()

    # Lista compartida donde las tools depositan imágenes a enviar al cliente
    pending_media: list[dict] = []

    # Métricas del turno (se acumulan a la conversación al cerrar)
    turn_tool_calls = 0
    turn_total_tokens = 0
    escalated_in_turn = False
    tools_called_in_turn: list[str] = []
    iterations = 0
    turn_start_ms = time.perf_counter()

    call_params = {
        "model": agent_config.get("model", "gpt-4o"),
        "messages": openai_messages,
        "temperature": agent_config.get("temperature", 0.6),
    }
    if tool_definitions:
        call_params["tools"] = tool_definitions
        call_params["tool_choice"] = "auto"

    try:
        response = client.chat.completions.create(**call_params)
        response_message = response.choices[0].message

        # Tokens del primer call
        if getattr(response, "usage", None):
            turn_total_tokens += int(response.usage.total_tokens or 0)

        iterations = 0
        while response_message.tool_calls and iterations < MAX_TOOL_ITERATIONS:
            iterations += 1
            openai_messages.append(response_message)

            for tool_call in response_message.tool_calls:
                fn_name = tool_call.function.name
                try:
                    fn_args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    fn_args = {}

                turn_tool_calls += 1
                if fn_name == "escalate_to_human":
                    escalated_in_turn = True
                tools_called_in_turn.append(fn_name)

                executor = TOOL_EXECUTORS.get(fn_name)
                t0 = time.perf_counter()
                if executor:
                    db.refresh(session)
                    try:
                        tool_result = executor(db, session, _pending_media=pending_media, **fn_args)
                    except Exception as exc:
                        logger.exception(f"[agent] tool {fn_name} crashed: {exc}")
                        tool_result = json.dumps({"error": f"tool {fn_name} crashed: {exc!s}"})
                else:
                    tool_result = json.dumps({"error": f"Tool no encontrada: {fn_name}"})
                dt_ms = int((time.perf_counter() - t0) * 1000)

                # Log estructurado: nombre, args truncados, primer chunk del resultado, timing
                logger.info(
                    f"[agent] iter={iterations} tool={fn_name} {dt_ms}ms "
                    f"args={json.dumps(fn_args, ensure_ascii=False)[:160]} "
                    f"result={tool_result[:200]}"
                )

                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })

            response = client.chat.completions.create(**call_params | {"messages": openai_messages})
            response_message = response.choices[0].message
            if getattr(response, "usage", None):
                turn_total_tokens += int(response.usage.total_tokens or 0)

        assistant_content = response_message.content or "Lo siento, no pude procesar tu solicitud."

    except Exception as e:
        logger.error(f"Error calling OpenAI: {e}", exc_info=True)
        assistant_content = "Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?"

    # ── 6.5. Stock-guard (red de seguridad — modo solo-log) ──
    # En la arquitectura Context-First, los datos de stock ya vienen en el
    # system prompt (bloque DATOS DISPONIBLES), así que el LLM debería
    # responder con la verdad. Si igual menciona "no hay stock" cuando el
    # prefetch decía que sí había, queremos detectarlo como bug a investigar.
    # Solo loggea — ya no reescribe la respuesta porque el prefetch es la
    # fuente de verdad y el guard ad-hoc agregaba falsos positivos.
    NO_STOCK_PHRASES = (
        "no hay stock", "no tenemos stock", "sin stock",
        "está agotado", "esta agotado", "agotado",
        "no contamos con stock", "no disponemos de stock",
        "fuera de stock",
    )
    lc = (assistant_content or "").lower()
    if any(p in lc for p in NO_STOCK_PHRASES):
        had_prefetch = bool(prefetched_block)
        logger.info(
            f"[stock-guard] agent mentioned 'no stock' "
            f"prefetch_was_present={had_prefetch} "
            f"tools_in_turn={tools_called_in_turn} "
            f"response_preview={assistant_content[:160]!r}"
        )

    # ── 7. Persistir respuesta ──
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_content,
    )
    db.add(assistant_msg)

    # Actualizar session
    db.refresh(session)
    session.last_agent_action = f"Responded at stage: {session.current_stage}"
    if agent:
        session.agent_id = agent.id
    db.add(session)

    # ── 8. Métricas en la Conversation ──
    db.refresh(conversation)
    conversation.tool_calls_count = (conversation.tool_calls_count or 0) + turn_tool_calls
    conversation.total_tokens = (conversation.total_tokens or 0) + turn_total_tokens
    conversation.last_stage_reached = session.current_stage

    # Outcome derivado: stage actual + flags del turno
    current_stage = session.current_stage
    if escalated_in_turn:
        conversation.outcome = "escalated"
        conversation.outcome_reason = "tool escalate_to_human invocada"
    elif current_stage == "completed":
        conversation.outcome = "sale_completed"
        conversation.outcome_reason = "venta finalizada"
    elif current_stage in ("lost", "abandoned"):
        conversation.outcome = "dropped_off"
        conversation.outcome_reason = f"stage={current_stage}"
    else:
        # Si todavía no estaba marcada como cerrada, es 'ongoing'
        if conversation.outcome in (None, "ongoing"):
            conversation.outcome = "ongoing"

    # Valor estimado: usar el de la session si existe
    if getattr(session, "estimated_value", None) is not None:
        try:
            conversation.estimated_value = session.estimated_value
        except Exception:
            pass

    db.add(conversation)
    db.commit()

    # ── 9. Auto-actualización del notebook (post-turno) ──
    # Llamada barata a gpt-4o-mini que extrae info nueva del último intercambio
    # y la mergea al notebook. Garantiza que el notebook se mantenga al día
    # incluso si el agente principal no llamó update_notebook explícitamente.
    try:
        from app.services.notebook_extractor import extract_and_apply
        extract_and_apply(
            db=db,
            session=session,
            user_message=message,
            assistant_message=assistant_content,
            openai_client=client,
        )
    except Exception as exc:
        logger.warning(f"[agent] notebook auto-extract skipped: {exc}")

    turn_total_ms = int((time.perf_counter() - turn_start_ms) * 1000)
    logger.info(
        f"[agent] turn done conv={conversation.id[:8]} stage={session.current_stage} "
        f"tools={turn_tool_calls} iters={iterations} "
        f"tokens={turn_total_tokens} {turn_total_ms}ms"
    )

    return {
        "response": assistant_content,
        "pending_media": pending_media,
        "conversation_id": conversation.id,
        "session_id": session.id,
        "stage": session.current_stage,
    }
