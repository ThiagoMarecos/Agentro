"""
Servicio de tiendas.
Crea tienda con StoreTheme, Settings iniciales y Agente de ventas IA.
"""

import json
import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.store import Store, StoreMember, StoreTheme
from app.models.settings import Setting
from app.models.ai import AIAgent
from app.repos.store_repo import get_by_slug, create as repo_create
from app.schemas.store import StoreCreate

logger = logging.getLogger(__name__)


def _create_default_sales_agent(db: Session, store_id: str, store_name: str) -> None:
    """Crea el agente de ventas por defecto para una tienda nueva."""
    try:
        agent = AIAgent(
            store_id=store_id,
            name=f"Vendedor {store_name}",
            description=f"Agente de ventas inteligente de {store_name}. Atiende clientes, busca productos, negocia y cierra ventas de forma autónoma.",
            system_prompt="",  # Vacío = usa el prompt maestro de agent_prompts.py
            agent_type="generic",
            is_active=True,
            enabled_tools=json.dumps(["all"]),
            config=json.dumps({
                "model": "gpt-4o",
                "temperature": 0.6,
            }),
        )
        db.add(agent)
        db.flush()
        logger.info(f"Default sales agent created for store {store_id}")
    except Exception as e:
        logger.error(f"Error creating default sales agent: {e}")


def create_store(db: Session, user_id: str, data: StoreCreate) -> Store:
    """Crea tienda, StoreMember (owner), StoreTheme, Settings y Agente IA."""
    slug = data.slug.lower().strip()
    if get_by_slug(db, slug):
        raise HTTPException(status_code=409, detail="El slug ya está en uso. Elige otro.")
    data.slug = slug
    store = repo_create(db, user_id, data)

    # Crear agente de ventas por defecto
    _create_default_sales_agent(db, store.id, store.name)
    db.commit()

    return store
