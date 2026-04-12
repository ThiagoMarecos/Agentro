"""
Endpoints de categorías.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.category_service import (
    get_category,
    list_categories,
    create_category,
    update_category,
    delete_category,
)
from app.services.audit_service import log_action, get_client_info

router = APIRouter()


@router.get("", response_model=list[CategoryResponse])
def list_store_categories(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista categorías de la tienda."""
    items = list_categories(db, store.id)
    return [CategoryResponse.model_validate(c) for c in items]


@router.post("", response_model=CategoryResponse)
def create_category_endpoint(
    data: CategoryCreate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea categoría."""
    cat = create_category(db, store.id, data)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "category.create", user_id=user.id, store_id=store.id,
        resource_type="category", resource_id=cat.id,
        details={"name": cat.name},
        ip_address=ip, user_agent=user_agent,
    )
    return CategoryResponse.model_validate(cat)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category_endpoint(
    category_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene categoría por ID."""
    cat = get_category(db, category_id, store.id)
    return CategoryResponse.model_validate(cat)


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category_endpoint(
    category_id: str,
    data: CategoryUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza categoría."""
    cat = update_category(db, category_id, store.id, data)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "category.update", user_id=user.id, store_id=store.id,
        resource_type="category", resource_id=cat.id,
        details={"name": cat.name},
        ip_address=ip, user_agent=user_agent,
    )
    return CategoryResponse.model_validate(cat)


@router.delete("/{category_id}")
def delete_category_endpoint(
    category_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina categoría. Los productos quedan sin categoría."""
    cat = get_category(db, category_id, store.id)
    delete_category(db, category_id, store.id)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "category.delete", user_id=user.id, store_id=store.id,
        resource_type="category", resource_id=category_id,
        details={"name": cat.name},
        ip_address=ip, user_agent=user_agent,
    )
    return {"success": True}
