"""
Motor de etapas de venta.
Controla las transiciones de etapa de una SalesSession.
Solo este servicio puede cambiar current_stage.
"""

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession
from app.services.audit_service import log_action

STAGES = [
    "incoming",
    "discovery",
    "recommendation",
    "validation",
    "closing",
    "payment",
    "order_created",
    "shipping",
    "completed",
    "lost",
    "abandoned",
]

TERMINAL_STAGES = {"completed", "lost", "abandoned"}


def _now():
    return datetime.now(timezone.utc)


def move_to_stage(
    db: Session,
    session: SalesSession,
    new_stage: str,
    reason: str | None = None,
    user_id: str | None = None,
) -> SalesSession:
    """Mueve la sesión a una nueva etapa. Valida que la etapa sea válida."""
    if new_stage not in STAGES:
        raise ValueError(f"Etapa inválida: {new_stage}")

    if session.current_stage in TERMINAL_STAGES:
        raise ValueError(f"No se puede mover desde etapa terminal: {session.current_stage}")

    old_stage = session.current_stage
    session.current_stage = new_stage
    session.stage_entered_at = _now()
    session.updated_at = _now()

    nb = session.get_notebook()
    nb["agent_control"]["last_action"] = f"stage_change: {old_stage} -> {new_stage}"
    if reason:
        nb["agent_control"]["flags"].append(f"stage_reason: {reason}")
    session.set_notebook(nb)

    if new_stage in TERMINAL_STAGES:
        session.closed_at = _now()
        if new_stage == "completed":
            session.status = "completed"
        elif new_stage == "lost":
            session.status = "lost"
        elif new_stage == "abandoned":
            session.status = "abandoned"

    db.add(session)
    db.commit()
    db.refresh(session)

    log_action(
        db,
        "sales_session.stage_change",
        user_id=user_id,
        store_id=session.store_id,
        resource_type="sales_session",
        resource_id=session.id,
        details={"from": old_stage, "to": new_stage, "reason": reason},
    )

    return session


def block_session(
    db: Session,
    session: SalesSession,
    reason: str,
) -> SalesSession:
    """Bloquea la sesión con un motivo."""
    session.blocker_reason = reason
    session.requires_manual_review = True
    session.updated_at = _now()

    nb = session.get_notebook()
    nb["agent_control"]["flags"].append(f"blocked: {reason}")
    session.set_notebook(nb)

    db.add(session)
    db.commit()
    db.refresh(session)

    log_action(
        db,
        "sales_session.blocked",
        store_id=session.store_id,
        resource_type="sales_session",
        resource_id=session.id,
        details={"reason": reason},
    )

    return session


def complete_session(db: Session, session: SalesSession) -> SalesSession:
    """Marca la sesión como completada."""
    return move_to_stage(db, session, "completed", reason="Venta completada")


def lose_session(db: Session, session: SalesSession, reason: str) -> SalesSession:
    """Marca la sesión como perdida."""
    return move_to_stage(db, session, "lost", reason=reason)


def abandon_session(db: Session, session: SalesSession) -> SalesSession:
    """Marca la sesión como abandonada."""
    return move_to_stage(db, session, "abandoned", reason="Cliente no respondió")
