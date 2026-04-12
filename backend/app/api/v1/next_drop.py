"""
Endpoints de Next Drop.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.next_drop import NextDropItem
from app.schemas.next_drop import NextDropItemCreate, NextDropItemUpdate, NextDropItemResponse

router = APIRouter()


@router.get("", response_model=list[NextDropItemResponse])
def list_store_drops(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista próximos drops de la tienda."""
    items = db.query(NextDropItem).filter(NextDropItem.store_id == store.id).order_by(NextDropItem.sort_order).all()
    return [NextDropItemResponse.model_validate(i) for i in items]


@router.post("", response_model=NextDropItemResponse)
def create_drop(
    data: NextDropItemCreate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea item de próximo drop."""
    item = NextDropItem(
        store_id=store.id,
        name=data.name,
        description=data.description,
        drop_date=data.drop_date,
        image_url=data.image_url,
        product_id=data.product_id,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return NextDropItemResponse.model_validate(item)


@router.get("/{item_id}", response_model=NextDropItemResponse)
def get_drop(
    item_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene drop por ID."""
    item = db.query(NextDropItem).filter(NextDropItem.id == item_id, NextDropItem.store_id == store.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Drop no encontrado")
    return NextDropItemResponse.model_validate(item)


@router.patch("/{item_id}", response_model=NextDropItemResponse)
def update_drop(
    item_id: str,
    data: NextDropItemUpdate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza drop."""
    item = db.query(NextDropItem).filter(NextDropItem.id == item_id, NextDropItem.store_id == store.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Drop no encontrado")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return NextDropItemResponse.model_validate(item)


@router.delete("/{item_id}")
def delete_drop(
    item_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina drop."""
    item = db.query(NextDropItem).filter(NextDropItem.id == item_id, NextDropItem.store_id == store.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Drop no encontrado")
    db.delete(item)
    db.commit()
    return {"success": True}
