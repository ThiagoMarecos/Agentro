"""
Simulador de chat para super admin.

Permite al super admin actuar como un cliente cualquiera, eligiendo una tienda
+ un identifier (teléfono ficticio o email) y conversar con el agente IA SIN
necesidad de tener WhatsApp configurado o un número real.

Útil para:
  - Testear cambios al prompt del agente sin spammear clientes reales
  - Iterar sobre flujos de venta
  - Validar el modo aprendizaje
  - Reproducir bugs

También incluye toggle GLOBAL de modo aprendizaje (todas las tiendas a la vez).
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import require_superadmin
from app.db.session import get_db
from app.models.ai import AIAgent, Conversation, Message
from app.models.customer import Customer
from app.models.sales_session import SalesSession
from app.models.store import Store
from app.models.user import User
from app.services.agent_runtime import process_message
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
#  Schemas
# ════════════════════════════════════════════════════════════════════

class SimStoreOption(BaseModel):
    id: str
    name: str
    slug: str


class SimMessageRequest(BaseModel):
    store_id: str
    customer_identifier: str  # phone +5959... o email
    message: str


class SimMessageResponse(BaseModel):
    response: str | None
    pending_media: list[dict[str, Any]] = []
    conversation_id: str
    session_id: str
    stage: str
    agent_paused: bool = False


class SimMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: str | None = None


class SimConversationResponse(BaseModel):
    conversation_id: str | None
    customer_id: str | None
    stage: str | None
    messages: list[SimMessage]


class SimResetRequest(BaseModel):
    store_id: str
    customer_identifier: str
    delete_customer: bool = True


class SimResetResponse(BaseModel):
    deleted_messages: int
    deleted_sessions: int
    deleted_conversations: int
    deleted_customers: int


class GlobalLearningModeRequest(BaseModel):
    enabled: bool


class GlobalLearningModeResponse(BaseModel):
    enabled: bool
    affected_agents: int
    affected_stores: int


# ════════════════════════════════════════════════════════════════════
#  Endpoints
# ════════════════════════════════════════════════════════════════════

@router.get("/stores", response_model=list[SimStoreOption])
def list_stores_for_simulator(
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Lista todas las tiendas (super admin) para el dropdown del simulador."""
    stores = db.query(Store).filter(Store.is_active == True).order_by(Store.name.asc()).all()
    return [SimStoreOption(id=s.id, name=s.name, slug=s.slug) for s in stores]


def _resolve_store_and_customer(
    db: Session, store_id: str, customer_identifier: str
) -> tuple[Store, Customer | None, Conversation | None]:
    """Helper para encontrar store + customer + conversation activa."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    is_email = "@" in customer_identifier
    if is_email:
        customer = db.query(Customer).filter(
            Customer.store_id == store_id,
            Customer.email == customer_identifier,
        ).first()
    else:
        customer = db.query(Customer).filter(
            Customer.store_id == store_id,
            Customer.phone == customer_identifier,
        ).first()

    conversation = None
    if customer:
        conversation = db.query(Conversation).filter(
            Conversation.store_id == store.id,
            Conversation.customer_id == customer.id,
            Conversation.status == "active",
        ).first()

    return store, customer, conversation


@router.get("/conversation", response_model=SimConversationResponse)
def get_simulator_conversation(
    store_id: str,
    customer_identifier: str,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Devuelve la conversación actual entre un identifier y una tienda."""
    store, customer, conv = _resolve_store_and_customer(db, store_id, customer_identifier)
    if not customer or not conv:
        return SimConversationResponse(
            conversation_id=None, customer_id=customer.id if customer else None,
            stage=None, messages=[],
        )
    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    session = (
        db.query(SalesSession)
        .filter(SalesSession.conversation_id == conv.id)
        .first()
    )
    return SimConversationResponse(
        conversation_id=conv.id,
        customer_id=customer.id,
        stage=session.current_stage if session else None,
        messages=[
            SimMessage(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat() if m.created_at else None,
            )
            for m in msgs
        ],
    )


@router.post("/send", response_model=SimMessageResponse)
def simulator_send_message(
    payload: SimMessageRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """
    Manda un mensaje al agente como si fuera un cliente real.
    Usa el mismo `process_message` que usa el webhook de WhatsApp y el
    chat web — así el flujo es idéntico.
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    store = db.query(Store).filter(Store.id == payload.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    try:
        result = process_message(
            db=db,
            store_id=store.id,
            channel="simulator",
            customer_identifier=payload.customer_identifier.strip(),
            message=payload.message.strip(),
        )
    except Exception as exc:
        logger.exception(f"[simulator] process_message failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Agente falló: {exc!s}")

    log_action(
        db, "simulator.message_sent",
        user_id=admin.id, store_id=store.id,
        resource_type="conversation", resource_id=result.get("conversation_id"),
        details={"identifier": payload.customer_identifier},
    )

    return SimMessageResponse(
        response=result.get("response"),
        pending_media=result.get("pending_media", []),
        conversation_id=result.get("conversation_id"),
        session_id=result.get("session_id"),
        stage=result.get("stage"),
        agent_paused=result.get("agent_paused", False),
    )


@router.post("/reset", response_model=SimResetResponse)
def simulator_reset(
    payload: SimResetRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """
    Borra la conversación + mensajes + sesión + (opcional) customer asociado
    a un identifier en una tienda. Útil para empezar el simulador desde cero.
    """
    store, customer, conv = _resolve_store_and_customer(
        db, payload.store_id, payload.customer_identifier
    )
    deleted_msgs = deleted_sessions = deleted_convs = deleted_customers = 0

    if conv:
        deleted_msgs = (
            db.query(Message).filter(Message.conversation_id == conv.id).delete()
        )
        deleted_sessions = (
            db.query(SalesSession).filter(SalesSession.conversation_id == conv.id).delete()
        )
        db.delete(conv)
        deleted_convs = 1

    if customer and payload.delete_customer:
        # Borrar también todas las conversaciones del customer (por si acaso quedaron huérfanas)
        other_convs = db.query(Conversation).filter(Conversation.customer_id == customer.id).all()
        for oc in other_convs:
            deleted_msgs += db.query(Message).filter(Message.conversation_id == oc.id).delete()
            deleted_sessions += db.query(SalesSession).filter(SalesSession.conversation_id == oc.id).delete()
            db.delete(oc)
            deleted_convs += 1
        db.delete(customer)
        deleted_customers = 1

    db.commit()

    log_action(
        db, "simulator.reset",
        user_id=admin.id, store_id=payload.store_id,
        details={
            "identifier": payload.customer_identifier,
            "delete_customer": payload.delete_customer,
            "deleted": {
                "msgs": deleted_msgs,
                "sessions": deleted_sessions,
                "convs": deleted_convs,
                "customers": deleted_customers,
            },
        },
    )

    return SimResetResponse(
        deleted_messages=deleted_msgs,
        deleted_sessions=deleted_sessions,
        deleted_conversations=deleted_convs,
        deleted_customers=deleted_customers,
    )


# ════════════════════════════════════════════════════════════════════
#  Toggle GLOBAL del modo aprendizaje
# ════════════════════════════════════════════════════════════════════

@router.get("/learning-mode/status", response_model=GlobalLearningModeResponse)
def get_global_learning_status(
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Retorna si TODOS los agentes tienen learning mode activo (true) o no."""
    total_agents = db.query(AIAgent).count()
    enabled_agents = db.query(AIAgent).filter(AIAgent.learning_mode_enabled == True).count()
    affected_stores = (
        db.query(AIAgent.store_id)
        .filter(AIAgent.learning_mode_enabled == True)
        .distinct()
        .count()
    )
    # "enabled" en sentido global = todos activos
    enabled = total_agents > 0 and enabled_agents == total_agents
    return GlobalLearningModeResponse(
        enabled=enabled,
        affected_agents=enabled_agents,
        affected_stores=affected_stores,
    )


@router.patch("/learning-mode/global", response_model=GlobalLearningModeResponse)
def set_global_learning_mode(
    payload: GlobalLearningModeRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """
    Activa o desactiva learning_mode_enabled en TODOS los agentes IA del sistema
    (todas las tiendas). Persiste en DB — no se pierde al refrescar la página.
    """
    agents = db.query(AIAgent).all()
    for a in agents:
        a.learning_mode_enabled = payload.enabled
        db.add(a)
    db.commit()

    affected_stores = len({a.store_id for a in agents})

    log_action(
        db, "admin.global_learning_mode",
        user_id=admin.id,
        details={"enabled": payload.enabled, "agents_affected": len(agents)},
    )

    return GlobalLearningModeResponse(
        enabled=payload.enabled,
        affected_agents=len(agents),
        affected_stores=affected_stores,
    )
