"""
Endpoints de clientes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.customer import Customer
from app.schemas.customer import CustomerResponse

router = APIRouter()


@router.get("", response_model=list[CustomerResponse])
def list_store_customers(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    """Lista clientes de la tienda."""
    customers = db.query(Customer).filter(Customer.store_id == store.id).offset(skip).limit(limit).all()
    return [CustomerResponse.model_validate(c) for c in customers]


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene cliente por ID."""
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return CustomerResponse.model_validate(customer)
