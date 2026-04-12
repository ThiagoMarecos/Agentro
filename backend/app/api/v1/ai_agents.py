"""
Endpoints de agentes IA.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User
from app.models.ai import AIAgent
from app.schemas.ai import AIAgentCreate, AIAgentUpdate, AIAgentResponse
from app.services.audit_service import log_action, get_client_info
from app.services.stage_agent_seeder import seed_stage_agents

router = APIRouter()


@router.get("", response_model=list[AIAgentResponse])
def list_store_agents(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista agentes IA de la tienda."""
    agents = db.query(AIAgent).filter(AIAgent.store_id == store.id).all()
    return [AIAgentResponse.model_validate(a) for a in agents]


@router.post("", response_model=AIAgentResponse)
def create_agent(
    data: AIAgentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea agente IA."""
    agent = AIAgent(
        store_id=store.id,
        name=data.name,
        description=data.description,
        system_prompt=data.system_prompt,
        config=data.config,
        is_active=data.is_active,
        agent_type=data.agent_type,
        stage_name=data.stage_name,
        display_name=data.display_name,
        tone=data.tone,
        language=data.language,
        sales_style=data.sales_style,
        enabled_tools=data.enabled_tools,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "ai_agent.create", user_id=user.id, store_id=store.id,
        resource_type="ai_agent", resource_id=agent.id,
        details={"name": agent.name},
        ip_address=ip, user_agent=user_agent,
    )

    return AIAgentResponse.model_validate(agent)


@router.post("/seed-stage-agents", response_model=list[AIAgentResponse])
def seed_store_stage_agents(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea los 9 stage agents por defecto para la tienda."""
    created = seed_stage_agents(db, store.id)
    return [AIAgentResponse.model_validate(a) for a in created]


@router.get("/stage-agents/list", response_model=list[AIAgentResponse])
def list_stage_agents(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista solo los stage agents de la tienda."""
    agents = db.query(AIAgent).filter(
        AIAgent.store_id == store.id,
        AIAgent.agent_type == "stage",
    ).all()
    return [AIAgentResponse.model_validate(a) for a in agents]


@router.get("/{agent_id}", response_model=AIAgentResponse)
def get_agent(
    agent_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene agente por ID."""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id, AIAgent.store_id == store.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente no encontrado")
    return AIAgentResponse.model_validate(agent)


@router.patch("/{agent_id}", response_model=AIAgentResponse)
def update_agent(
    agent_id: str,
    data: AIAgentUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza agente IA."""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id, AIAgent.store_id == store.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente no encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agent, key, value)
    db.commit()
    db.refresh(agent)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "ai_agent.update", user_id=user.id, store_id=store.id,
        resource_type="ai_agent", resource_id=agent.id,
        details={"name": agent.name},
        ip_address=ip, user_agent=user_agent,
    )

    return AIAgentResponse.model_validate(agent)


@router.delete("/bulk/stage-agents")
def delete_all_stage_agents(
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina todos los stage agents de la tienda."""
    count = db.query(AIAgent).filter(
        AIAgent.store_id == store.id,
        AIAgent.agent_type == "stage",
    ).delete()
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "ai_agent.bulk_delete_stage", user_id=user.id, store_id=store.id,
        resource_type="ai_agent", resource_id="bulk",
        details={"deleted_count": count},
        ip_address=ip, user_agent=user_agent,
    )

    return {"success": True, "deleted": count}


@router.delete("/bulk/all")
def delete_all_agents(
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina TODOS los agentes de la tienda (stage + generic)."""
    count = db.query(AIAgent).filter(
        AIAgent.store_id == store.id,
    ).delete()
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "ai_agent.bulk_delete_all", user_id=user.id, store_id=store.id,
        resource_type="ai_agent", resource_id="bulk",
        details={"deleted_count": count},
        ip_address=ip, user_agent=user_agent,
    )

    return {"success": True, "deleted": count}


@router.patch("/bulk/toggle-all")
def toggle_all_agents(
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Activa o desactiva todos los agentes de la tienda (invierte el estado)."""
    agents = db.query(AIAgent).filter(AIAgent.store_id == store.id).all()
    any_active = any(a.is_active for a in agents)
    new_state = not any_active
    count = 0
    for a in agents:
        a.is_active = new_state
        count += 1
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "ai_agent.bulk_toggle", user_id=user.id, store_id=store.id,
        resource_type="ai_agent", resource_id="bulk",
        details={"new_state": new_state, "count": count},
        ip_address=ip, user_agent=user_agent,
    )

    return {"success": True, "is_active": new_state, "count": count}


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina agente IA."""
    agent = db.query(AIAgent).filter(AIAgent.id == agent_id, AIAgent.store_id == store.id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agente no encontrado")
    db.delete(agent)
    db.commit()
    return {"success": True}
