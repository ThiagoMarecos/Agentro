"""
Tools de notificación al dueño de la tienda.
"""

import json

from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession
from app.services.audit_service import log_action


def tool_notify_owner(db: Session, session: SalesSession, **params) -> str:
    """Marca que el dueño ha sido notificado y registra en AuditLog."""
    reason = params.get("reason", "Notificación del agente")
    urgency = params.get("urgency", "normal")

    session.owner_notified = True
    db.add(session)
    db.commit()

    log_action(
        db,
        "sales_session.owner_notified",
        store_id=session.store_id,
        resource_type="sales_session",
        resource_id=session.id,
        details={
            "reason": reason,
            "urgency": urgency,
            "stage": session.current_stage,
        },
    )

    return json.dumps({
        "success": True,
        "notified": True,
        "reason": reason,
        "urgency": urgency,
    })


NOTIFICATION_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "notify_owner",
            "description": "Notificar al dueño de la tienda sobre una situación importante en la venta",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Razón de la notificación"},
                    "urgency": {
                        "type": "string",
                        "description": "Nivel de urgencia",
                        "enum": ["low", "normal", "high", "critical"],
                    },
                },
                "required": ["reason"],
            },
        },
    },
]
