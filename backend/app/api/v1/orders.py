"""
Endpoints de pedidos.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.order import Order
from app.models.customer import Customer, Address
from app.schemas.order import (
    OrderResponse,
    OrderDetailResponse,
    OrderItemResponse,
    OrderFullDetailResponse,
    OrderCustomerInfo,
    OrderAddressInfo,
    OrderStatusUpdate,
)

router = APIRouter()


@router.get("", response_model=list[OrderResponse])
def list_store_orders(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
):
    """Lista pedidos de la tienda."""
    orders = db.query(Order).filter(Order.store_id == store.id).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}")
def get_order(
    order_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene pedido por ID con detalles completos."""
    order = db.query(Order).filter(Order.id == order_id, Order.store_id == store.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    items = [OrderItemResponse.model_validate(i) for i in order.items]

    customer_info = None
    address_info = None
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            customer_info = OrderCustomerInfo.model_validate(customer)
            first_address = db.query(Address).filter(Address.customer_id == customer.id).first()
            if first_address:
                address_info = OrderAddressInfo.model_validate(first_address)

    base = OrderResponse.model_validate(order).model_dump()
    return OrderFullDetailResponse(
        **base,
        items=items,
        customer=customer_info,
        address=address_info,
        notes=order.notes,
    )


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza el estado de un pedido."""
    order = db.query(Order).filter(Order.id == order_id, Order.store_id == store.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    valid_statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Opciones: {', '.join(valid_statuses)}")

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return OrderResponse.model_validate(order)
