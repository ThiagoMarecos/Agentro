"""
Endpoints CRUD para proveedores.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import Store
from app.models.supplier import Supplier
from app.core.dependencies import get_current_store
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/", response_model=List[SupplierResponse])
def list_suppliers(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    return (
        db.query(Supplier)
        .filter(Supplier.store_id == store.id)
        .order_by(Supplier.name)
        .all()
    )


@router.post("/", response_model=SupplierResponse, status_code=201)
def create_supplier(
    payload: SupplierCreate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    supplier = Supplier(
        id=str(uuid.uuid4()),
        store_id=store.id,
        **payload.model_dump(),
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.store_id == store.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    payload: SupplierUpdate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.store_id == store.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)

    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(
    supplier_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.store_id == store.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    db.delete(supplier)
    db.commit()
