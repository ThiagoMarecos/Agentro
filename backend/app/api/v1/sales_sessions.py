"""
Endpoints de sesiones de venta y pipeline.
"""

import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.sales_session import SalesSession
from app.models.customer import Customer
from app.schemas.sales_session import (
    SalesSessionResponse,
    SalesSessionUpdate,
    SalesSessionListItem,
    PipelineStage,
    PipelineResponse,
    NotebookSection,
)
from app.services.stage_engine import STAGES

router = APIRouter()


def _session_to_list_item(session: SalesSession, db: Session) -> SalesSessionListItem:
    customer_email = None
    customer_name = None
    if session.customer_id:
        customer = db.query(Customer).filter(Customer.id == session.customer_id).first()
        if customer:
            customer_email = customer.email
            customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or customer.email

    return SalesSessionListItem(
        id=session.id,
        conversation_id=session.conversation_id,
        current_stage=session.current_stage,
        status=session.status,
        estimated_value=session.estimated_value,
        currency=session.currency or "USD",
        priority=session.priority or "medium",
        customer_email=customer_email,
        customer_name=customer_name,
        last_agent_action=session.last_agent_action,
        follow_up_count=session.follow_up_count or 0,
        started_at=str(session.started_at) if session.started_at else None,
        stage_entered_at=str(session.stage_entered_at) if session.stage_entered_at else None,
    )


@router.get("", response_model=list[SalesSessionListItem])
def list_sales_sessions(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
    status: str | None = None,
    stage: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    """Lista sesiones de venta de la tienda."""
    query = db.query(SalesSession).filter(SalesSession.store_id == store.id)

    if status:
        query = query.filter(SalesSession.status == status)
    if stage:
        query = query.filter(SalesSession.current_stage == stage)

    sessions = query.order_by(SalesSession.updated_at.desc()).offset(skip).limit(limit).all()
    return [_session_to_list_item(s, db) for s in sessions]


@router.get("/pipeline", response_model=PipelineResponse)
def get_pipeline(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Sesiones agrupadas por etapa para vista Kanban."""
    sessions = db.query(SalesSession).filter(
        SalesSession.store_id == store.id,
        SalesSession.status == "active",
    ).order_by(SalesSession.updated_at.desc()).all()

    grouped: dict[str, list] = defaultdict(list)
    for s in sessions:
        grouped[s.current_stage].append(_session_to_list_item(s, db))

    stages = []
    for stage_name in STAGES:
        items = grouped.get(stage_name, [])
        stages.append(PipelineStage(
            stage=stage_name,
            count=len(items),
            sessions=items,
        ))

    return PipelineResponse(stages=stages, total=len(sessions))


@router.get("/{session_id}", response_model=SalesSessionResponse)
def get_sales_session(
    session_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Detalle de sesión con notebook."""
    session = db.query(SalesSession).filter(
        SalesSession.id == session_id,
        SalesSession.store_id == store.id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    nb = session.get_notebook()

    return SalesSessionResponse(
        id=session.id,
        store_id=session.store_id,
        agent_id=session.agent_id,
        conversation_id=session.conversation_id,
        customer_id=session.customer_id,
        channel_id=session.channel_id,
        current_stage=session.current_stage,
        status=session.status,
        estimated_value=session.estimated_value,
        currency=session.currency or "USD",
        priority=session.priority or "medium",
        blocker_reason=session.blocker_reason,
        last_agent_action=session.last_agent_action,
        next_expected_action=session.next_expected_action,
        follow_up_count=session.follow_up_count or 0,
        owner_notified=session.owner_notified or False,
        requires_manual_review=session.requires_manual_review or False,
        started_at=str(session.started_at) if session.started_at else None,
        stage_entered_at=str(session.stage_entered_at) if session.stage_entered_at else None,
        closed_at=str(session.closed_at) if session.closed_at else None,
        notebook=NotebookSection(**nb),
    )


@router.patch("/{session_id}", response_model=SalesSessionResponse)
def update_sales_session(
    session_id: str,
    data: SalesSessionUpdate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza campos manuales de la sesión."""
    session = db.query(SalesSession).filter(
        SalesSession.id == session_id,
        SalesSession.store_id == store.id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    db.add(session)
    db.commit()
    db.refresh(session)

    return get_sales_session(session_id, store, db)
