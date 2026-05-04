"""
Endpoints de clientes.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.customer import Customer
from app.schemas.customer import CustomerResponse, CreateCustomerRequest, UpdateCustomerRequest

router = APIRouter()


def _norm(s: str | None) -> str | None:
    if s is None:
        return None
    s = s.strip()
    return s or None


@router.get("", response_model=list[CustomerResponse])
def list_store_customers(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
):
    """Lista clientes de la tienda. search filtra por email/nombre/teléfono."""
    q = db.query(Customer).filter(Customer.store_id == store.id)
    if search:
        like = f"%{search.lower()}%"
        q = q.filter(
            (Customer.email.ilike(like))
            | (Customer.first_name.ilike(like))
            | (Customer.last_name.ilike(like))
            | (Customer.phone.ilike(like))
        )
    customers = q.offset(skip).limit(limit).all()
    return [CustomerResponse.model_validate(c) for c in customers]


@router.post("", response_model=CustomerResponse)
def create_customer(
    payload: CreateCustomerRequest,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Crea un cliente. Útil desde el POS para registrar a alguien que viene
    al local. Solo first_name (o phone) es requerido. Si no se pasa email,
    generamos uno placeholder único para satisfacer la constraint unique.
    """
    first_name = _norm(payload.first_name)
    last_name = _norm(payload.last_name)
    phone = _norm(payload.phone)
    email = _norm(payload.email)
    document = _norm(payload.document)

    if not (first_name or phone or email):
        raise HTTPException(
            status_code=400,
            detail="Ingresá al menos nombre, teléfono o email.",
        )

    # Si vino email, chequear duplicado dentro del store
    if email:
        existing = (
            db.query(Customer)
            .filter(Customer.store_id == store.id, Customer.email == email)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un cliente con el email {email}",
            )
    else:
        # Email placeholder único — el modelo lo requiere not-null
        email = f"pos-{uuid.uuid4().hex[:10]}@local.agentro"

    customer = Customer(
        store_id=store.id,
        email=email,
        first_name=first_name or "",
        last_name=last_name,
        phone=phone,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

    # Si vino documento (cédula/RUC), lo registramos en audit log
    # (el modelo Customer no tiene campo document por ahora).
    if document:
        from app.services.audit_service import log_action
        try:
            log_action(
                db,
                "customer.document_recorded",
                store_id=store.id,
                resource_type="customer",
                resource_id=customer.id,
                details={"document": document},
            )
        except Exception:
            db.rollback()

    return CustomerResponse.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    payload: UpdateCustomerRequest,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza datos de un cliente."""
    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.store_id == store.id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if payload.first_name is not None:
        customer.first_name = _norm(payload.first_name) or ""
    if payload.last_name is not None:
        customer.last_name = _norm(payload.last_name)
    if payload.phone is not None:
        customer.phone = _norm(payload.phone)
    if payload.email is not None:
        new_email = _norm(payload.email)
        if new_email and new_email != customer.email:
            existing = (
                db.query(Customer)
                .filter(
                    Customer.store_id == store.id,
                    Customer.email == new_email,
                    Customer.id != customer.id,
                )
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail="Ya existe otro cliente con ese email")
            customer.email = new_email

    db.add(customer)
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


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
