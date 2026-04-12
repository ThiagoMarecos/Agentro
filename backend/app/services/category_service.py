"""
Servicio de categorías.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.repos.category_repo import get_by_id, get_by_slug, list_by_store, create, update, delete
from app.schemas.category import CategoryCreate, CategoryUpdate


def get_category(db: Session, category_id: str, store_id: str):
    cat = get_by_id(db, category_id, store_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return cat


def list_categories(db: Session, store_id: str):
    return list_by_store(db, store_id)


def create_category(db: Session, store_id: str, data: CategoryCreate):
    existing = get_by_slug(db, data.slug, store_id)
    if existing:
        raise HTTPException(status_code=409, detail="El slug ya está en uso en esta tienda")
    return create(db, store_id, data)


def update_category(db: Session, category_id: str, store_id: str, data: CategoryUpdate):
    cat = get_category(db, category_id, store_id)
    if data.slug is not None:
        existing = get_by_slug(db, data.slug, store_id)
        if existing and existing.id != category_id:
            raise HTTPException(status_code=409, detail="El slug ya está en uso en esta tienda")
    return update(db, cat, data)


def delete_category(db: Session, category_id: str, store_id: str) -> None:
    cat = get_category(db, category_id, store_id)
    delete(db, cat)
