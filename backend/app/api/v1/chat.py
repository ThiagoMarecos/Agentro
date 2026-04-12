"""
Endpoint de chat: recibe mensajes del storefront y ejecuta AgentRuntime.
No requiere auth de usuario admin, solo X-Store-ID.
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import Store
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse
from app.services.agent_runtime import process_message

router = APIRouter()


def _get_store_by_header(
    x_store_id: str = Header(..., alias="X-Store-ID"),
    db: Session = Depends(get_db),
) -> Store:
    store = db.query(Store).filter(Store.id == x_store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    return store


@router.post("/message", response_model=ChatMessageResponse)
def chat_message(
    data: ChatMessageRequest,
    store: Store = Depends(_get_store_by_header),
    db: Session = Depends(get_db),
):
    """Procesa un mensaje de chat y devuelve la respuesta del agente."""
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    result = process_message(
        db=db,
        store_id=store.id,
        channel=data.channel,
        customer_identifier=data.customer_identifier,
        message=data.message.strip(),
    )

    return ChatMessageResponse(**result)
