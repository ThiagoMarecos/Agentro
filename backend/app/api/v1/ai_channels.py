"""
Endpoints de canales IA.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.ai import AIChannel
from app.schemas.ai import AIChannelCreate, AIChannelResponse

router = APIRouter()


@router.get("", response_model=list[AIChannelResponse])
def list_store_channels(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista canales IA de la tienda."""
    channels = db.query(AIChannel).filter(AIChannel.store_id == store.id).all()
    return [AIChannelResponse.model_validate(c) for c in channels]


@router.post("", response_model=AIChannelResponse)
def create_channel(
    data: AIChannelCreate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea canal IA."""
    channel = AIChannel(
        store_id=store.id,
        channel_type=data.channel_type,
        agent_id=data.agent_id,
        config=data.config,
        is_active=data.is_active,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return AIChannelResponse.model_validate(channel)


@router.get("/{channel_id}", response_model=AIChannelResponse)
def get_channel(
    channel_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene canal por ID."""
    channel = db.query(AIChannel).filter(AIChannel.id == channel_id, AIChannel.store_id == store.id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal no encontrado")
    return AIChannelResponse.model_validate(channel)
