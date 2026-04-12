"""
Endpoints de conversaciones.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.ai import Conversation, Message
from app.models.customer import Customer
from app.models.sales_session import SalesSession
from app.schemas.ai import ConversationResponse, ConversationDetailResponse, MessageResponse

router = APIRouter()


@router.get("", response_model=list[ConversationDetailResponse])
def list_store_conversations(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    """Lista conversaciones de la tienda con info extra."""
    convs = (
        db.query(Conversation)
        .filter(Conversation.store_id == store.id)
        .order_by(Conversation.updated_at.desc())
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
