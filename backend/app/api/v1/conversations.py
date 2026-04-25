"""
Endpoints de conversaciones.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store, StoreMember
from app.models.ai import Conversation, Message
from app.models.customer import Customer
from app.models.sales_session import SalesSession
from app.models.user import User, RoleEnum
from app.schemas.ai import ConversationResponse, ConversationDetailResponse, MessageResponse
from app.schemas.team import (
    AssignConversationRequest,
    AssignConversationResponse,
    TakeControlResponse,
)
from app.services.audit_service import log_action

router = APIRouter()


def _get_user_role_in_store(db: Session, store: Store, user: User) -> str | None:
    """Devuelve el rol del usuario en la tienda. None si superadmin o no es miembro."""
    if getattr(user, "is_superadmin", False):
        return RoleEnum.OWNER.value
    member = (
        db.query(StoreMember)
        .filter(StoreMember.store_id == store.id, StoreMember.user_id == user.id)
        .first()
    )
    return member.role if member else None


@router.get("", response_model=list[ConversationDetailResponse])
def list_store_conversations(
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    needs_assignment: bool = False,  # filtrar bandeja "sin asignar"
    assigned_to_me: bool = False,    # filtrar "mis chats"
):
    """
    Lista conversaciones de la tienda.

    Filtros:
      - needs_assignment=true → solo las que están esperando asignación (FASE 5)
      - assigned_to_me=true → solo las asignadas al usuario actual

    Restricciones por rol:
      - SELLER: solo ve sus chats asignados (force assigned_to_me=true)
      - SUPPORT/MANAGER/ADMIN/OWNER: ve toda la tienda
    """
    role = _get_user_role_in_store(db, store, user)

    query = db.query(Conversation).filter(Conversation.store_id == store.id)

    # Sellers solo ven lo suyo, ignorando los flags
    if role == RoleEnum.SELLER.value:
        query = query.filter(Conversation.assigned_user_id == user.id)
    else:
        if needs_assignment:
            query = query.filter(Conversation.needs_seller_assignment == True)
        if assigned_to_me:
            query = query.filter(Conversation.assigned_user_id == user.id)

    convs = (
        query.order_by(Conversation.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for c in convs:
        customer_name = None
        customer_email = None
        if c.customer_id:
            customer = db.query(Customer).filter(Customer.id == c.customer_id).first()
            if customer:
                customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or customer.email
                customer_email = customer.email

        ss = db.query(SalesSession).filter(
            SalesSession.conversation_id == c.id,
            SalesSession.status == "active",
        ).first()

        last_msg = (
            db.query(Message)
            .filter(Message.conversation_id == c.id)
            .order_by(Message.created_at.desc())
            .first()
        )

        results.append(ConversationDetailResponse(
            id=c.id,
            store_id=c.store_id,
            channel_id=c.channel_id,
            customer_id=c.customer_id,
            channel_type=c.channel_type,
            status=c.status,
            messages=[MessageResponse.model_validate(last_msg)] if last_msg else [],
            customer_name=customer_name,
            customer_email=customer_email,
            session_id=ss.id if ss else None,
            current_stage=ss.current_stage if ss else None,
        ))

    return results


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene conversación por ID con todos los mensajes."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.store_id == store.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    customer_name = None
    customer_email = None
    if conv.customer_id:
        customer = db.query(Customer).filter(Customer.id == conv.customer_id).first()
        if customer:
            customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or customer.email
            customer_email = customer.email

    ss = db.query(SalesSession).filter(
        SalesSession.conversation_id == conv.id,
        SalesSession.status == "active",
    ).first()

    return ConversationDetailResponse(
        id=conv.id,
        store_id=conv.store_id,
        channel_id=conv.channel_id,
        customer_id=conv.customer_id,
        channel_type=conv.channel_type,
        status=conv.status,
        messages=[MessageResponse.model_validate(m) for m in messages],
        customer_name=customer_name,
        customer_email=customer_email,
        session_id=ss.id if ss else None,
        current_stage=ss.current_stage if ss else None,
    )


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
def get_conversation_messages(
    conversation_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista mensajes de una conversación."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.store_id == store.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [MessageResponse.model_validate(m) for m in messages]


# ════════════════════════════════════════════════════════════════════
#  Asignación a vendedor + control humano (Sesión 2B)
# ════════════════════════════════════════════════════════════════════

@router.patch("/{conversation_id}/assign", response_model=AssignConversationResponse)
def assign_conversation(
    conversation_id: str,
    payload: AssignConversationRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Asigna (o desasigna) una conversación a un usuario del equipo.
    Solo owner/admin/manager pueden asignar. Pasar user_id=None para desasignar.
    """
    role = _get_user_role_in_store(db, store, user)
    if role not in {
        RoleEnum.OWNER.value,
        RoleEnum.ADMIN.value,
        RoleEnum.MANAGER.value,
    }:
        raise HTTPException(status_code=403, detail="Solo manager+ pueden asignar")

    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.store_id == store.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    if payload.user_id:
        # Validar que el usuario sea miembro de la tienda
        target_member = (
            db.query(StoreMember)
            .filter(
                StoreMember.store_id == store.id,
                StoreMember.user_id == payload.user_id,
            )
            .first()
        )
        if not target_member:
            raise HTTPException(
                status_code=400,
                detail="El usuario no es miembro de esta tienda",
            )
        conv.assigned_user_id = payload.user_id
        conv.assigned_at = datetime.now(timezone.utc)
        conv.needs_seller_assignment = False
    else:
        conv.assigned_user_id = None
        conv.assigned_at = None
        conv.needs_seller_assignment = True

    db.add(conv)
    db.commit()
    db.refresh(conv)

    log_action(
        db,
        "conversation.assigned" if payload.user_id else "conversation.unassigned",
        user_id=user.id,
        store_id=store.id,
        resource_type="conversation",
        resource_id=conv.id,
        details={"to_user_id": payload.user_id},
    )

    return AssignConversationResponse(
        conversation_id=conv.id,
        assigned_user_id=conv.assigned_user_id,
        assigned_at=conv.assigned_at,
        needs_seller_assignment=conv.needs_seller_assignment or False,
    )


@router.post("/{conversation_id}/take-control", response_model=TakeControlResponse)
def take_control(
    conversation_id: str,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marca la conversación como controlada por el humano (agent_paused=True).
    El agente IA deja de responder automáticamente — el vendedor maneja desde acá.

    Cualquier rol con acceso al chat puede tomar control.
    """
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.store_id == store.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    role = _get_user_role_in_store(db, store, user)
    # Si es seller, solo puede tomar control de chats asignados a él
    if role == RoleEnum.SELLER.value and conv.assigned_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo podés tomar control de chats asignados a vos",
        )

    conv.agent_paused = True
    # Si nadie tenía asignado el chat y el que toma es seller, lo asignamos a sí mismo
    if not conv.assigned_user_id and role == RoleEnum.SELLER.value:
        conv.assigned_user_id = user.id
        conv.assigned_at = datetime.now(timezone.utc)
        conv.needs_seller_assignment = False
    db.add(conv)
    db.commit()

    log_action(
        db,
        "conversation.take_control",
        user_id=user.id,
        store_id=store.id,
        resource_type="conversation",
        resource_id=conv.id,
    )

    return TakeControlResponse(conversation_id=conv.id, agent_paused=True)


@router.post("/{conversation_id}/release", response_model=TakeControlResponse)
def release_to_agent(
    conversation_id: str,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve el control al agente IA (agent_paused=False)."""
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.store_id == store.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    role = _get_user_role_in_store(db, store, user)
    if role == RoleEnum.SELLER.value and conv.assigned_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo podés liberar chats asignados a vos",
        )

    conv.agent_paused = False
    db.add(conv)
    db.commit()

    log_action(
        db,
        "conversation.release_to_agent",
        user_id=user.id,
        store_id=store.id,
        resource_type="conversation",
        resource_id=conv.id,
    )

    return TakeControlResponse(conversation_id=conv.id, agent_paused=False)
