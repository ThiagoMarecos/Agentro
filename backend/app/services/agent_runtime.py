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
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import get_settings, get_dynamic_setting
from app.models.ai import Conversation, Message, AIAgent
from app.models.customer import Customer
from app.models.store import Store
from app.models.sales_session import SalesSession, EMPTY_NOTEBOOK
from app.services.agent_tools import get_tools_for_agent, TOOL_EXECUTORS
from app.services.agent_prompts import build_sales_prompt
from app.services.platform_settings_service import get_setting_value

logger = logging.getLogger(__name__)

# SECURITY: limitado a 8 para balancear funcionalidad vs costo.
# El agente de ventas necesita más iteraciones que antes (buscar, verificar stock,
# actualizar notebook, mover stage, etc.) en un solo turno.
MAX_TOOL_ITERATIONS = 8


def _get_openai_client() -> OpenAI:
    api_key = get_dynamic_setting("openai_api_key")
    if not api_key:
        raise ValueError("OPENAI_API_KEY no configurada en el servidor.")
    return OpenAI(api_key=api_key)


def _find_or_create_customer(
    db: Session, store_id: str, identifier: str
) -> Customer:
    """Busca o crea un customer por email o teléfono."""
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

    if not customer:
        customer = Customer(
            store_id=store_id,
            email=identifier if is_email else f"{identifier}@chat.agentro.app",
            phone=identifier if not is_email else None,
            first_name="",
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    return customer


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


def _get_message_history(db: Session, conversation_id: str, limit: int = 30) -> list[dict]:
    """Carga los últimos mensajes de la conversación."""
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
    ).order_by(Message.created_at.asc()).limit(limit).all()

    return [{"role": m.role, "content": m.content} for m in messages]


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
    customer = _find_or_create_customer(db, store_id, customer_identifier)
    conversation = _find_or_create_conversation(db, store_id, customer.id, channel)
    session = _find_or_create_session(db, store_id, conversation.id, customer.id)

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

    # ── 3. Prompt maestro de ventas ──
    # El prompt está definido en agent_prompts.py (fuente de verdad).
    # Las instrucciones del dueño se inyectan como custom_instructions (AIAgent.system_prompt).
    # NO usamos master_prompt_override porque reemplazaba el prompt entero y rompía el flujo.
    system_prompt = build_sales_prompt(
        store_name=store_name,
        store_config=store_config,
        session=session,
        custom_instructions=custom_instructions,
    )

    # Modelo configurable desde platform settings
    model_override = get_setting_value(db, "agent_model")
    if model_override:
        agent_config["model"] = model_override

    # ── 4. Tools ──
    enabled_tools = _get_enabled_tools(agent)
    # Si no hay configuración explícita, habilitar TODAS las tools para ventas
    if not enabled_tools:
        enabled_tools = ["all"]
    tool_definitions = get_tools_for_agent(enabled_tools)

    # ── 5. Historial + mensaje actual ──
    history = _get_message_history(db, conversation.id)
    openai_messages = [{"role": "system", "content": system_prompt}]
    openai_messages.extend(history)

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

                logger.info(f"Tool call: {fn_name}({json.dumps(fn_args, ensure_ascii=False)[:200]})")

                executor = TOOL_EXECUTORS.get(fn_name)
                if executor:
                    db.refresh(session)
                    # Inyectamos _pending_media para que tools como send_product_image
                    # puedan añadir imágenes a la cola de envío
                    tool_result = executor(db, session, _pending_media=pending_media, **fn_args)
                else:
                    tool_result = json.dumps({"error": f"Tool no encontrada: {fn_name}"})

                openai_messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": tool_result,
                })

            response = client.chat.completions.create(**call_params | {"messages": openai_messages})
            response_message = response.choices[0].message

        assistant_content = response_message.content or "Lo siento, no pude procesar tu solicitud."

    except Exception as e:
        logger.error(f"Error calling OpenAI: {e}", exc_info=True)
        assistant_content = "Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?"

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
    db.commit()

    return {
        "response": assistant_content,
        "pending_media": pending_media,
        "conversation_id": conversation.id,
        "session_id": session.id,
        "stage": session.current_stage,
    }
