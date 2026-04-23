"""
Endpoints CRUD para lecciones del modo aprendizaje del agente IA.
Las lecciones son instrucciones que el dueño escribe para corregir comportamiento del agente
y se inyectan automáticamente al prompt cuando learning_mode_enabled=True.
"""

from datetime import datetime
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
from app.services.audit_service import log_action, get_client_info


router = APIRouter()


def _serialize(lesson: AgentLesson) -> AgentLessonResponse:
    return AgentLessonResponse(
        id=lesson.id,
        agent_id=lesson.agent_id,
        store_id=lesson.store_id,
        title=lesson.title,
        lesson_text=lesson.lesson_text,
        bad_response_example=lesson.bad_response_example,
        correct_response=lesson.correct_response,
        category=lesson.category,
        is_active=lesson.is_active,
        priority=lesson.priority,
        source_conversation_id=lesson.source_conversation_id,
        created_at=lesson.created_at.isoformat() if lesson.created_at else None,
    )


@router.get("", response_model=list[AgentLessonResponse])
def list_lessons(
    agent_id: str | None = None,
    only_active: bool = False,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista lecciones de la tienda. Opcionalmente filtradas por agent_id / activas."""
    q = db.query(AgentLesson).filter(AgentLesson.store_id == store.id)
    if agent_id:
        q = q.filter(AgentLesson.agent_id == agent_id)
    if only_active:
        q = q.filter(AgentLesson.is_active == True)
    lessons = q.order_by(
        AgentLesson.priority.asc().nullslast(),
        AgentLesson.created_at.desc(),
    ).all()
    return [_serialize(l) for l in lessons]


@router.post("", response_model=AgentLessonResponse)
def create_lesson(
    data: AgentLessonCreate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea una lección para un agente. El agente debe pertenecer a la tienda."""
    agent = db.query(AIAgent).filter(
        AIAgent.id == data.agent_id,
        AIAgent.store_id == store.id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente no encontrado")

    lesson = AgentLesson(
        store_id=store.id,
        agent_id=data.agent_id,
        title=data.title,
        lesson_text=data.lesson_text,
        bad_response_example=data.bad_response_example,
        correct_response=data.correct_response,
        category=data.category,
        is_active=data.is_active,
        priority=data.priority if data.priority is not None else 5,
        source_conversation_id=data.source_conversation_id,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "agent_lesson.create", user_id=user.id, store_id=store.id,
        resource_type="agent_lesson", resource_id=lesson.id,
        details={"agent_id": data.agent_id, "title": data.title, "category": data.category},
        ip_address=ip, user_agent=user_agent,
    )

    return _serialize(lesson)


@router.patch("/{lesson_id}", response_model=AgentLessonResponse)
def update_lesson(
    lesson_id: str,
    data: AgentLessonUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza una lección."""
    lesson = db.query(AgentLesson).filter(
        AgentLesson.id == lesson_id,
        AgentLesson.store_id == store.id,
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lección no encontrada")

    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(lesson, k, v)
    db.commit()
    db.refresh(lesson)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "agent_lesson.update", user_id=user.id, store_id=store.id,
        resource_type="agent_lesson", resource_id=lesson.id,
        details={"changes": list(update_data.keys())},
        ip_address=ip, user_agent=user_agent,
    )

    return _serialize(lesson)


@router.delete("/{lesson_id}")
def delete_lesson(
    lesson_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina una lección."""
    lesson = db.query(AgentLesson).filter(
        AgentLesson.id == lesson_id,
        AgentLesson.store_id == store.id,
    ).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lección no encontrada")

    db.delete(lesson)
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "agent_lesson.delete", user_id=user.id, store_id=store.id,
        resource_type="agent_lesson", resource_id=lesson_id,
        details={},
        ip_address=ip, user_agent=user_agent,
    )

    return {"success": True}


@router.post("/agent/{agent_id}/toggle-learning-mode")
def toggle_learning_mode(
    agent_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Activa/desactiva el modo aprendizaje del agente."""
    agent = db.query(AIAgent).filter(
        AIAgent.id == agent_id,
        AIAgent.store_id == store.id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente no encontrado")

    new_state = not bool(agent.learning_mode_enabled)
    agent.learning_mode_enabled = new_state
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "ai_agent.toggle_learning_mode", user_id=user.id, store_id=store.id,
        resource_type="ai_agent", resource_id=agent.id,
        details={"learning_mode_enabled": new_state},
        ip_address=ip, user_agent=user_agent,
    )

    return {"success": True, "learning_mode_enabled": new_state}
