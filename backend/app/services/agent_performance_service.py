"""
Servicio de métricas y rendimiento del agente IA.
Calcula funnel, outcomes, dropoff por etapa, top productos buscados,
escalaciones y tiempos de respuesta.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, case, and_, or_
from sqlalchemy.orm import Session

from app.models.ai import Conversation, Message
from app.models.sales_session import SalesSession


# Orden canónico del funnel
FUNNEL_STAGES = [
    "incoming",
    "discovery",
    "recommendation",
    "validation",
    "closing",
    "payment",
    "order_created",
    "shipping",
    "completed",
]


def _date_range(days: int) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return start, end


def get_overview_stats(db: Session, store_id: str, days: int = 30) -> dict[str, Any]:
    """
    Tarjetas principales del dashboard.
    """
    start, end = _date_range(days)

    total_convs = db.query(func.count(Conversation.id)).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
    ).scalar() or 0

    completed = db.query(func.count(Conversation.id)).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
        Conversation.outcome == "sale_completed",
    ).scalar() or 0

    escalated = db.query(func.count(Conversation.id)).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
        Conversation.outcome == "escalated",
    ).scalar() or 0

    dropped = db.query(func.count(Conversation.id)).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
        Conversation.outcome.in_(["dropped_off", "abandoned"]),
    ).scalar() or 0

    total_msgs = db.query(func.count(Message.id)).join(
        Conversation, Message.conversation_id == Conversation.id
    ).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
    ).scalar() or 0

    total_tokens = db.query(func.coalesce(func.sum(Conversation.total_tokens), 0)).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
    ).scalar() or 0

    total_value = db.query(func.coalesce(func.sum(Conversation.estimated_value), 0)).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
        Conversation.outcome == "sale_completed",
    ).scalar() or 0

    success_rate = (completed / total_convs * 100) if total_convs else 0.0

    # Costo estimado de tokens (gpt-4o aprox: $5 / 1M tokens input, $15 / 1M output, prom $10)
    estimated_cost_usd = float(total_tokens) * (10.0 / 1_000_000)

    return {
        "days": days,
        "total_conversations": int(total_convs),
        "completed_sales": int(completed),
        "escalated": int(escalated),
        "dropped": int(dropped),
        "ongoing": int(total_convs - completed - escalated - dropped),
        "total_messages": int(total_msgs),
        "total_tokens": int(total_tokens),
        "estimated_cost_usd": round(estimated_cost_usd, 2),
        "success_rate": round(success_rate, 1),
        "total_sales_value": float(total_value),
    }


def get_funnel_stats(db: Session, store_id: str, days: int = 30) -> list[dict[str, Any]]:
    """
    Para cada etapa, cuántas sesiones la alcanzaron (cumulativo descendente).
    Una conversación en 'closing' también pasó por 'discovery' y 'recommendation'.
    """
    start, _ = _date_range(days)

    # Reach counts: sesiones que llegaron a cada etapa o más adelante
    rows = db.query(
        SalesSession.current_stage,
        func.count(SalesSession.id).label("count"),
    ).filter(
        SalesSession.store_id == store_id,
        SalesSession.started_at >= start,
    ).group_by(SalesSession.current_stage).all()

    counts: dict[str, int] = {stage: 0 for stage in FUNNEL_STAGES}
    for stage, count in rows:
        if stage in counts:
            counts[stage] = int(count)

    # Para cada etapa, sumar la suya y todas las posteriores
    cumulative: dict[str, int] = {}
    for i, stage in enumerate(FUNNEL_STAGES):
        cumulative[stage] = sum(counts[s] for s in FUNNEL_STAGES[i:])

    total = cumulative[FUNNEL_STAGES[0]] or 1
    funnel: list[dict[str, Any]] = []
    prev_count = total
    for stage in FUNNEL_STAGES:
        c = cumulative[stage]
        dropoff_pct = round((1 - c / prev_count) * 100, 1) if prev_count else 0.0
        funnel.append({
            "stage": stage,
            "count": c,
            "percent_of_total": round((c / total) * 100, 1) if total else 0.0,
            "dropoff_from_previous_pct": dropoff_pct if stage != FUNNEL_STAGES[0] else 0.0,
        })
        prev_count = c

    return funnel


def get_dropoff_analysis(db: Session, store_id: str, days: int = 30) -> list[dict[str, Any]]:
    """
    Etapas donde más se cae el cliente (mayor dropoff porcentual).
    """
    funnel = get_funnel_stats(db, store_id, days)
    sorted_dropoff = sorted(
        [s for s in funnel if s["stage"] != FUNNEL_STAGES[0]],
        key=lambda x: x["dropoff_from_previous_pct"],
        reverse=True,
    )
    return sorted_dropoff[:5]


def get_outcome_breakdown(db: Session, store_id: str, days: int = 30) -> list[dict[str, Any]]:
    """
    Distribución de outcomes (sale_completed, dropped, escalated, etc).
    """
    start, _ = _date_range(days)

    rows = db.query(
        func.coalesce(Conversation.outcome, "ongoing").label("outcome"),
        func.count(Conversation.id).label("count"),
    ).filter(
        Conversation.store_id == store_id,
        Conversation.created_at >= start,
    ).group_by(Conversation.outcome).all()

    return [{"outcome": o, "count": int(c)} for o, c in rows]


def get_recent_conversations(
    db: Session,
    store_id: str,
    limit: int = 50,
    outcome: str | None = None,
    stage: str | None = None,
) -> list[dict[str, Any]]:
    """
    Lista de conversaciones recientes con métricas para inspección rápida.
    """
    q = db.query(
        Conversation.id,
        Conversation.created_at,
        Conversation.outcome,
        Conversation.outcome_reason,
        Conversation.last_stage_reached,
        Conversation.tool_calls_count,
        Conversation.total_tokens,
        Conversation.estimated_value,
        SalesSession.current_stage,
    ).outerjoin(
        SalesSession, SalesSession.conversation_id == Conversation.id
    ).filter(
        Conversation.store_id == store_id,
    )

    if outcome:
        q = q.filter(Conversation.outcome == outcome)
    if stage:
        q = q.filter(
            or_(
                SalesSession.current_stage == stage,
                Conversation.last_stage_reached == stage,
            )
        )

    rows = q.order_by(Conversation.created_at.desc()).limit(limit).all()

    return [
        {
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "outcome": r.outcome or "ongoing",
            "outcome_reason": r.outcome_reason,
            "last_stage_reached": r.last_stage_reached or r.current_stage,
            "tool_calls_count": r.tool_calls_count or 0,
            "total_tokens": r.total_tokens or 0,
            "estimated_value": float(r.estimated_value) if r.estimated_value is not None else None,
        }
        for r in rows
    ]


def get_response_time_stats(db: Session, store_id: str, days: int = 30) -> dict[str, Any]:
    """
    Tiempo medio de respuesta del agente (delta entre user→assistant).
    Aproximado: media de delta en segundos para los pares consecutivos.
    """
    start, _ = _date_range(days)

    # Trae mensajes ordenados por conversación
    rows = db.query(
        Message.conversation_id,
        Message.role,
        Message.created_at,
    ).join(
        Conversation, Conversation.id == Message.conversation_id
    ).filter(
        Conversation.store_id == store_id,
        Message.created_at >= start,
    ).order_by(Message.conversation_id, Message.created_at).all()

    deltas: list[float] = []
    last_user_at: dict[str, datetime] = {}
    for conv_id, role, created_at in rows:
        if role == "user":
            last_user_at[conv_id] = created_at
        elif role == "assistant" and conv_id in last_user_at:
            delta = (created_at - last_user_at[conv_id]).total_seconds()
            if 0 < delta < 600:  # filtrar outliers (>10min)
                deltas.append(delta)
            del last_user_at[conv_id]

    if not deltas:
        return {"count": 0, "avg_seconds": 0.0, "median_seconds": 0.0}

    deltas.sort()
    avg = sum(deltas) / len(deltas)
    median = deltas[len(deltas) // 2]
    return {
        "count": len(deltas),
        "avg_seconds": round(avg, 2),
        "median_seconds": round(median, 2),
    }


def get_zero_result_searches(db: Session, store_id: str, days: int = 30, limit: int = 20) -> list[dict[str, Any]]:
    """
    Estimación basada en mensajes del agente que dicen 'no encontré' / 'no tenemos'.
    Es una heurística — útil para detectar productos faltantes en catálogo.
    """
    start, _ = _date_range(days)

    patterns = ["no encontr", "no tenemos", "no contamos", "lamentablemente no", "no disponemos"]

    counter: dict[str, int] = {}
    msgs = db.query(Message.content, Message.conversation_id).join(
        Conversation, Conversation.id == Message.conversation_id
    ).filter(
        Conversation.store_id == store_id,
        Message.role == "assistant",
        Message.created_at >= start,
    ).all()

    for content, _ in msgs:
        if not content:
            continue
        low = content.lower()
        if any(p in low for p in patterns):
            # extraer palabra "X" del contexto: heurística simple — primer sustantivo después de patrón
            for p in patterns:
                if p in low:
                    after = low.split(p, 1)[1][:60]
                    key = after.strip().split(".")[0][:50]
                    if key:
                        counter[key] = counter.get(key, 0) + 1
                    break

    items = sorted(counter.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"query_excerpt": q, "occurrences": c} for q, c in items]


def get_full_dashboard(db: Session, store_id: str, days: int = 30) -> dict[str, Any]:
    """Endpoint todo-en-uno para hidratar el dashboard de rendimiento."""
    return {
        "overview": get_overview_stats(db, store_id, days),
        "funnel": get_funnel_stats(db, store_id, days),
        "dropoff": get_dropoff_analysis(db, store_id, days),
        "outcomes": get_outcome_breakdown(db, store_id, days),
        "response_time": get_response_time_stats(db, store_id, days),
        "zero_result_searches": get_zero_result_searches(db, store_id, days),
    }
