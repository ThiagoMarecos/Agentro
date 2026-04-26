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
    SendManualReplyRequest,
    SendManualReplyResponse,
    SuggestReplyRequest,
    SuggestReplyResponse,
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

    notification_target_user: User | None = None
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
        previous_assignee = conv.assigned_user_id
        conv.assigned_user_id = payload.user_id
        conv.assigned_at = datetime.now(timezone.utc)
        conv.needs_seller_assignment = False
        # Notificamos solo si el assignee CAMBIÓ (no en re-asignaciones idempotentes)
        if previous_assignee != payload.user_id:
            notification_target_user = (
                db.query(User).filter(User.id == payload.user_id).first()
            )
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

    # Notificaciones al vendedor (email + WhatsApp interno) — no bloqueantes
    if notification_target_user and notification_target_user.id != user.id:
        try:
            from app.services.seller_notifications import notify_seller_of_assignment
            result = notify_seller_of_assignment(
                db=db,
                store=store,
                seller=notification_target_user,
                conversation=conv,
            )
            log_action(
                db,
                "conversation.assignment_notified",
                user_id=user.id,
                store_id=store.id,
                resource_type="conversation",
                resource_id=conv.id,
                details=result,
            )
        except Exception as exc:
            # Nunca bloqueamos la asignación por un fallo de notificación
            log_action(
                db,
                "conversation.assignment_notification_error",
                user_id=user.id,
                store_id=store.id,
                resource_type="conversation",
                resource_id=conv.id,
                details={"error": str(exc)},
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


# ════════════════════════════════════════════════════════════════════
#  Modo copiloto (Sesión 3)
# ════════════════════════════════════════════════════════════════════

@router.post("/{conversation_id}/suggest-reply", response_model=SuggestReplyResponse)
def suggest_reply_for_conversation(
    conversation_id: str,
    payload: SuggestReplyRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Pide una sugerencia de respuesta al agente IA (modo copiloto).
    El agente NO envía nada — solo genera el texto que el vendedor puede
    revisar, editar y enviar manualmente con send-manual-reply.
    """
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.store_id == store.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    role = _get_user_role_in_store(db, store, user)
    # Sellers solo pueden pedir sugerencias en sus chats
    if role == RoleEnum.SELLER.value and conv.assigned_user_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="Solo podés usar copiloto en chats asignados a vos",
        )

    from app.services.copilot import suggest_reply

    result = suggest_reply(
        db=db,
        store=store,
        conversation=conv,
        additional_hint=payload.additional_hint,
    )

    log_action(
        db,
        "conversation.copilot_suggestion",
        user_id=user.id,
        store_id=store.id,
        resource_type="conversation",
        resource_id=conv.id,
        details={
            "model": result.get("model"),
            "tokens": result.get("tokens"),
            "latency_ms": result.get("latency_ms"),
            "had_hint": bool(payload.additional_hint),
        },
    )

    return SuggestReplyResponse(
        suggestion=result.get("suggestion", ""),
        model=result.get("model"),
        tokens=result.get("tokens", 0),
        latency_ms=result.get("latency_ms", 0),
    )


@router.post("/{conversation_id}/send-manual-reply", response_model=SendManualReplyResponse)
def send_manual_reply(
    conversation_id: str,
    payload: SendManualReplyRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Envía un mensaje manual del vendedor al cliente.
    Persiste el mensaje como 'assistant' (visualmente sale del lado del agente)
    y, si la conversación es de WhatsApp, lo envía vía Evolution API.
    """
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
            detail="Solo podés responder chats asignados a vos",
        )

    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    # Persistir como mensaje del lado assistant
    msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=text,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Si es WhatsApp, intentamos enviarlo via Evolution
    via_whatsapp = False
    if conv.channel_type == "whatsapp" and conv.customer_id:
        try:
            from app.models.ai import AIChannel
            customer = db.query(Customer).filter(Customer.id == conv.customer_id).first()
            channel = (
                db.query(AIChannel)
                .filter(
                    AIChannel.store_id == store.id,
                    AIChannel.channel_type == "whatsapp",
                    AIChannel.is_active == True,
                )
                .first()
            )
            if channel and channel.instance_name and customer and customer.phone:
                import asyncio
                from app.services.evolution_api import send_text_message

                phone_clean = "".join(ch for ch in customer.phone if ch.isdigit())
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(
                        send_text_message(
                            instance_name=channel.instance_name,
                            to_number=phone_clean,
                            text=text,
                            instance_token=channel.instance_token,
                        )
                    )
                    via_whatsapp = True
                finally:
                    loop.close()
        except Exception as exc:
            # No bloqueamos: el mensaje queda guardado en la DB aunque WA falle
            log_action(
                db,
                "conversation.manual_reply_wa_error",
                user_id=user.id,
                store_id=store.id,
                resource_type="conversation",
                resource_id=conv.id,
                details={"error": str(exc)},
            )

    log_action(
        db,
        "conversation.manual_reply_sent",
        user_id=user.id,
        store_id=store.id,
        resource_type="conversation",
        resource_id=conv.id,
        details={"via_whatsapp": via_whatsapp, "length": len(text)},
    )

    return SendManualReplyResponse(
        sent=True,
        message_id=msg.id,
        via_whatsapp=via_whatsapp,
    )
