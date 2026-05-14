"""
Tools de notebook y control de etapas.
"""

import json

from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession
from app.services.stage_engine import move_to_stage, STAGES


def _normalize_order_items(raw_items) -> list[dict]:
    """
    Defensivo: el LLM a veces manda items como strings o como lista mixta.
    Devolvemos siempre una lista de dicts con al menos {name} para no romper
    el render del carrito ni los renders downstream.
    """
    if not isinstance(raw_items, list):
        return []
    out: list[dict] = []
    for it in raw_items:
        if isinstance(it, dict):
            out.append(it)
        elif isinstance(it, str) and it.strip():
            out.append({"name": it.strip()})
        # ignoramos None, números sueltos, etc.
    return out


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

    # Para la sección "order", normalizar el campo `items` si viene presente.
    # Garantiza que siempre quede como list[dict] aunque el LLM lo arme mal.
    if section == "order" and isinstance(data, dict) and "items" in data:
        data = {**data, "items": _normalize_order_items(data.get("items"))}

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
            "description": (
                "Mover la sesión a la siguiente fase del flujo Agentro v2. "
                "Las únicas etapas que el agente IA puede setear son: "
                "discovery (FASE 1), validation (FASE 2), negotiation (FASE 3), "
                "data_collection (FASE 4), lost (cliente no avanza), abandoned "
                "(no responde). Para llegar a escalated_to_seller usá "
                "`handoff_to_seller` (no esta tool)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "stage": {
                        "type": "string",
                        "description": "Nueva etapa del flujo de pre-venta",
                        "enum": [
                            "discovery", "validation", "negotiation",
                            "data_collection", "lost", "abandoned",
                        ],
                    },
                    "reason": {"type": "string", "description": "Razón del cambio de etapa"},
                },
                "required": ["stage"],
            },
        },
    },
]
