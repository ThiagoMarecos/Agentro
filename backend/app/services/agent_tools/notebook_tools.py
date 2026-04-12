"""
Tools de notebook y control de etapas.
"""

import json

from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession
from app.services.stage_engine import move_to_stage, STAGES


def tool_update_notebook(db: Session, session: SalesSession, **params) -> str:
    """Actualiza una sección del notebook con nuevos datos."""
    section = params.get("section", "")
    data = params.get("data", {})

    if not section:
        return json.dumps({"error": "Se requiere especificar la sección"})

    valid_sections = [
        "customer", "intent", "interest", "recommendation",
        "pricing", "availability", "shipping", "payment",
        "order", "agent_control",
    ]

    if section not in valid_sections:
        return json.dumps({"error": f"Sección inválida: {section}. Válidas: {valid_sections}"})

    session.update_notebook_section(section, data)
    db.add(session)
    db.commit()

    return json.dumps({"success": True, "section": section, "updated_fields": list(data.keys())})


def tool_move_stage(db: Session, session: SalesSession, **params) -> str:
    """Solicita un cambio de etapa via StageEngine."""
    new_stage = params.get("stage", "")
    reason = params.get("reason", "")

    if new_stage not in STAGES:
        return json.dumps({"error": f"Etapa inválida: {new_stage}. Válidas: {STAGES}"})

    try:
        updated = move_to_stage(db, session, new_stage, reason=reason)
        return json.dumps({
            "success": True,
            "previous_stage": session.current_stage,
            "new_stage": updated.current_stage,
            "reason": reason,
        })
    except ValueError as e:
        return json.dumps({"error": str(e)})


NOTEBOOK_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "update_notebook",
            "description": "Actualizar la memoria contextual del agente (notebook) con información recopilada del cliente",
            "parameters": {
                "type": "object",
                "properties": {
                    "section": {
                        "type": "string",
                        "description": "Sección del notebook a actualizar",
                        "enum": [
                            "customer", "intent", "interest", "recommendation",
                            "pricing", "availability", "shipping", "payment",
                            "order", "agent_control",
                        ],
                    },
                    "data": {
                        "type": "object",
                        "description": "Datos a actualizar en la sección (merge con existentes)",
                    },
                },
                "required": ["section", "data"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_stage",
            "description": "Mover la sesión de venta a una nueva etapa del pipeline",
            "parameters": {
                "type": "object",
                "properties": {
                    "stage": {
                        "type": "string",
                        "description": "Nueva etapa",
                        "enum": [
                            "incoming", "discovery", "recommendation", "validation",
                            "closing", "payment", "order_created", "shipping",
                            "completed", "lost", "abandoned",
                        ],
                    },
                    "reason": {"type": "string", "description": "Razón del cambio de etapa"},
                },
                "required": ["stage"],
            },
        },
    },
]
