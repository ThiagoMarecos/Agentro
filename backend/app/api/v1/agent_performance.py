"""
Endpoints de rendimiento del agente IA + lecciones del modo aprendizaje.

Expone:
- GET  /agent-performance/dashboard           → todas las métricas en un solo payload
- GET  /agent-performance/overview            → tarjetas de overview
- GET  /agent-performance/funnel              → embudo etapa por etapa
- GET  /agent-performance/dropoff             → top etapas con mayor drop-off
- GET  /agent-performance/outcomes            → distribución de outcomes
- GET  /agent-performance/response-time       → tiempos de respuesta del agente
- GET  /agent-performance/zero-results        → consultas sin resultados (heurística)
- GET  /agent-performance/conversations       → conversaciones recientes (con filtros)

- GET  /agent-lessons                         → lista lecciones (filtra por agent_id)
- POST /agent-lessons                         → crea lección
- PATCH /agent-lessons/{lesson_id}            → actualiza lección
- DELETE /agent-lessons/{lesson_id}           → elimina lección

- POST /ai-agents/{agent_id}/learning-mode    → toggle modo aprendizaje
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User
from app.models.ai import AIAgent, AgentLesson
from app.schemas.ai import (
    AgentLessonCreate,
    AgentLessonUpdate,
    AgentLessonResponse,
)
from app.services import agent_performance_service as perf
from app.services.audit_service import log_action, get_client_info


router = APIRouter()


# ────────────────────────────────────────────────────────────────
# Performance dashboard
# ────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard(
    days: int = Query(30, ge=1, le=365),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Payload todo-en-uno para hidratar el dashboard de rendimiento."""
    return perf.get_full_dashboard(db, store.id, days)


@router.get("/overview")
def get_overview(
    days: int = Query(30, ge=1, le=365),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_overview_stats(db, store.id, days)


@router.get("/funnel")
def get_funnel(
    days: int = Query(30, ge=1, le=365),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_funnel_stats(db, store.id, days)


@router.get("/dropoff")
def get_dropoff(
    days: int = Query(30, ge=1, le=365),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_dropoff_analysis(db, store.id, days)


@router.get("/outcomes")
def get_outcomes(
    days: int = Query(30, ge=1, le=365),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_outcome_breakdown(db, store.id, days)


@router.get("/response-time")
def get_response_time(
    days: int = Query(30, ge=1, le=365),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_response_time_stats(db, store.id, days)


@router.get("/zero-results")
def get_zero_results(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_zero_result_searches(db, store.id, days, limit)


@router.get("/conversations")
def list_recent_conversations(
    limit: int = Query(50, ge=1, le=200),
    outcome: str | None = None,
    stage: str | None = None,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return perf.get_recent_conversations(db, store.id, limit, outcome, stage)
