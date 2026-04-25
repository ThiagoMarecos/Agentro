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
    # ── Flujo del agente IA (pre-venta) ──
    # Sigue el diagrama: Inicio → Validación → Negociación → Recopilación → Escalamiento
    "incoming",
    "discovery",
    "validation",         # FASE 2: validar producto en DB + proveedor
    "negotiation",        # FASE 3: presentar propuesta, descuentos, objeciones
    "data_collection",    # FASE 4: recopilar datos del cliente para el handoff
    "escalated_to_seller", # FASE 5: handoff completo, esperando que vendedor humano tome
    # ── Estados terminales ──
    "lost",       # Conversación finalizada sin escalamiento (cliente no avanza)
    "abandoned",  # Cliente no respondió luego de N reintentos
    # ── Stages legacy (manejados por vendedor humano post-handoff, no por agente) ──
    # Quedan para compatibilidad con conversaciones viejas y para que el vendedor
    # pueda seguir moviéndolas manualmente si quiere trackear post-venta.
    "recommendation",   # legacy: ahora cubierto por validation/negotiation
    "closing",          # legacy: ahora cubierto por data_collection
    "payment",          # legacy: el agente NO maneja pago — vendedor humano cierra
    "order_created",    # legacy: idem
    "shipping",         # legacy: idem
    "completed",        # legacy: cuando vendedor cerró exitosamente
]

TERMINAL_STAGES = {"completed", "lost", "abandoned"}

# Stages que el agente IA puede SETEAR via tool move_stage
# (los demás solo los puede cambiar el vendedor humano via UI)
AGENT_REACHABLE_STAGES = {
    "incoming", "discovery", "validation", "negotiation",
    "data_collection", "escalated_to_seller", "lost", "abandoned",
}


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
