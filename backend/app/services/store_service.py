"""
Servicio de tiendas.
Crea tienda con StoreTheme y Settings iniciales.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.store import Store, StoreMember, StoreTheme
from app.models.settings import Setting
from app.repos.store_repo import get_by_slug, create as repo_create
from app.schemas.store import StoreCreate


def create_store(db: Session, user_id: str, data: StoreCreate) -> Store:
    """Crea tienda, StoreMember (owner), StoreTheme y Settings iniciales."""
    slug = data.slug.lower().strip()
    if get_by_slug(db, slug):
        raise HTTPException(status_code=409, detail="El slug ya está en uso. Elige otro.")
    data.slug = slug
    return repo_create(db, user_id, data)
