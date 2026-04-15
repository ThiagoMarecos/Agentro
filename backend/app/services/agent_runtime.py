"""
AgentRuntime: orquesta el flujo completo de un mensaje de chat.
1. Busca/crea Customer, Conversation, SalesSession
2. Selecciona el StageAgent correspondiente
3. Llama OpenAI con function calling
4. Ejecuta tools en loop
5. Persiste mensajes y notebook
"""

import json
import logging
from datetime import datetime, timezone

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import get_settings, get_dynamic_setting
from app.models.ai import Conversation, Message, AIAgent
from app.models.customer import Customer
from app.models.sales_session import SalesSession, EMPTY_NOTEBOOK
from app.services.agent_tools import get_tools_for_agent, TOOL_EXECUTORS

logger = logging.getLogger(__name__)

# SECURITY: limitado a 5 para contener el costo máximo por request a 6 llamadas OpenAI.
# Valor anterior (10) permitía hasta 11 llamadas → ataque de cost-bomb.
MAX_TOOL_ITERATIONS = 5


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
            email=identifier if is_email else f"{identifier}@chat.nexora.app",
            phone=identifier if not is_email else None,
            first_name="Cliente Chat",
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


def _get_stage_agent(
    db: Session, store_id: str, stage: str
) -> AIAgent | None:
    """Obtiene el agente configurado para una etapa."""
    agent = db.query(AIAgent).filter(
        AIAgent.store_id == store_id,
        AIAgent.agent_type == "stage",
        AIAgent.stage_name == stage,
        AIAgent.is_active == True,
    ).first()
    return agent


def _build_system_prompt(agent: AIAgent | None, session: SalesSession) -> str:
    """Construye el system prompt con el contexto del notebook."""
    nb = session.get_notebook()

    base_prompt = (
        agent.system_prompt if agent and agent.system_prompt
        else _default_system_prompt(session.current_stage)
    )

    notebook_context = (
        f"\n\n--- CONTEXTO DEL NOTEBOOK (memoria de la venta) ---\n"
        f"Etapa actual: {session.current_stage}\n"
        f"Cliente: {json.dumps(nb.get('customer', {}), ensure_ascii=False)}\n"
        f"Intención: {json.dumps(nb.get('intent', {}), ensure_ascii=False)}\n"
        f"Interés: {json.dumps(nb.get('interest', {}), ensure_ascii=False)}\n"
        f"Recomendación: {json.dumps(nb.get('recommendation', {}), ensure_ascii=False)}\n"
        f"Pricing: {json.dumps(nb.get('pricing', {}), ensure_ascii=False)}\n"
        f"Disponibilidad: {json.dumps(nb.get('availability', {}), ensure_ascii=False)}\n"
        f"Envío: {json.dumps(nb.get('shipping', {}), ensure_ascii=False)}\n"
        f"Pago: {json.dumps(nb.get('payment', {}), ensure_ascii=False)}\n"
        f"Orden: {json.dumps(nb.get('order', {}), ensure_ascii=False)}\n"
        f"--- FIN CONTEXTO ---"
    )

    return base_prompt + notebook_context


def _default_system_prompt(stage: str) -> str:
    """Prompt por defecto si no hay agente configurado."""
    return (
        f"Eres un agente de ventas experto y amigable. "
        f"Estás en la etapa '{stage}' del proceso de venta. "
        f"Tu objetivo es ayudar al cliente a encontrar lo que necesita y cerrar la venta. "
        f"Usa las herramientas disponibles para buscar productos, verificar disponibilidad, "
        f"y avanzar en el proceso de venta. "
        f"Siempre actualiza el notebook con información relevante del cliente. "
        f"Responde siempre en español a menos que el cliente hable otro idioma."
    )


def _get_message_history(db: Session, conversation_id: str, limit: int = 20) -> list[dict]:
    """Carga los últimos mensajes de la conversación."""
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id,
    ).order_by(Message.created_at.asc()).limit(limit).all()

    return [{"role": m.role, "content": m.content} for m in messages]


def _get_agent_config(agent: AIAgent | None) -> dict:
    """Extrae model, temperature, etc. del agente."""
    settings = get_settings()
    defaults = {
        "model": settings.openai_default_model,
        "temperature": 0.7,
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
        return json.loads(agent.enabled_tools)
    except (json.JSONDecodeError, TypeError):
        return None


def process_message(
    db: Session,
    store_id: str,
    channel: str,
    customer_identifier: str,
    message: str,
) -> dict:
    """
    Flujo principal:
    1. Customer -> Conversation -> SalesSession
    2. Stage Agent -> OpenAI (tools loop)
    3. Persist messages + notebook
    4. Return response
    """
    customer = _find_or_create_customer(db, store_id, customer_identifier)
    conversation = _find_or_create_conversation(db, store_id, customer.id, channel)
    session = _find_or_create_session(db, store_id, conversation.id, customer.id)

    nb = session.get_notebook()
    if customer.email and not nb["customer"].get("email"):
        nb["customer"]["email"] = customer.email
    if customer.first_name and not nb["customer"].get("name"):
        nb["customer"]["name"] = customer.first_name
    if customer.phone and not nb["customer"].get("phone"):
        nb["customer"]["phone"] = customer.phone or ""
    session.set_notebook(nb)

    agent = _get_stage_agent(db, store_id, session.current_stage)
    system_prompt = _build_system_prompt(agent, session)
    agent_config = _get_agent_config(agent)
    enabled_tools = _get_enabled_tools(agent)
    tool_definitions = get_tools_for_agent(enabled_tools)

    history = _get_message_history(db, conversation.id)
    openai_messages = [{"role": "system", "content": system_prompt}]
    openai_messages.extend(history)
    openai_messages.append({"role": "user", "content": message})

    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    db.commit()

    client = _get_openai_client()

    call_params = {
        "model": agent_config.get("model", "gpt-4o"),
        "messages": openai_messages,
        "temperature": agent_config.get("temperature", 0.7),
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

                executor = TOOL_EXECUTORS.get(fn_name)
                if executor:
                    db.refresh(session)
                    tool_result = executor(db, session, **fn_args)
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
        logger.error(f"Error calling OpenAI: {e}")
        assistant_content = "Disculpa, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?"

    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=assistant_content,
    )
    db.add(assistant_msg)

    db.refresh(session)
    session.last_agent_action = f"Responded at stage: {session.current_stage}"
    if agent:
        session.agent_id = agent.id
    db.add(session)
    db.commit()

    return {
        "response": assistant_content,
        "conversation_id": conversation.id,
        "session_id": session.id,
        "stage": session.current_stage,
    }
