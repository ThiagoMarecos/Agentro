"""
Endpoints del POS (Point of Sale).

Rutas:
  GET  /pos/cash-register/current        — caja abierta del usuario actual
  POST /pos/cash-register/open           — abre caja con efectivo inicial
  POST /pos/cash-register/close          — cierra caja con cuadre
  POST /pos/sale                         — registra venta + crea Order + descuenta stock
  POST /pos/orders/{id}/refund           — devolución total/parcial + repone stock
"""

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.db.session import get_db
from app.models.ai import Conversation
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.payment import CashRegister, PaymentMethod, Refund
from app.models.product import Product, ProductVariant
from app.models.store import Store, StoreMember
from app.models.user import RoleEnum, User
from app.schemas.payment import (
    CashRegisterResponse,
    CloseCashRegisterRequest,
    OpenCashRegisterRequest,
    POSSaleRequest,
    POSSaleResponse,
    RefundRequest,
    RefundResponse,
)
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
#  Helpers
# ════════════════════════════════════════════════════════════════════

def _ensure_member(db: Session, store: Store, user: User) -> str:
    """
    Verifica que el user sea miembro de la tienda y devuelve su rol.
    Owner/Admin/Manager/Seller pueden usar el POS. Support no.
    """
    if getattr(user, "is_superadmin", False):
        return RoleEnum.OWNER.value
    member = (
        db.query(StoreMember)
        .filter(StoreMember.store_id == store.id, StoreMember.user_id == user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Sin acceso al POS de esta tienda")
    if member.role == RoleEnum.SUPPORT.value:
        raise HTTPException(status_code=403, detail="El rol Support no puede usar el POS")
    return member.role


def _open_register(db: Session, store_id: str, user_id: str) -> CashRegister | None:
    """Devuelve la caja abierta del usuario en la tienda, o None."""
    return (
        db.query(CashRegister)
        .filter(
            CashRegister.store_id == store_id,
            CashRegister.user_id == user_id,
            CashRegister.closed_at.is_(None),
        )
        .order_by(CashRegister.opened_at.desc())
        .first()
    )


def _decimal(v) -> Decimal:
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


def _is_cash_provider(method: PaymentMethod | None) -> bool:
    if not method:
        return False
    return method.provider == "efectivo"


# ════════════════════════════════════════════════════════════════════
#  Cash register (caja por usuario)
# ════════════════════════════════════════════════════════════════════

@router.get("/cash-register/current", response_model=CashRegisterResponse | None)
def get_current_register(
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve la caja actualmente abierta del usuario, o null si no tiene."""
    _ensure_member(db, store, user)
    reg = _open_register(db, store.id, user.id)
    if not reg:
        return None
    return CashRegisterResponse.model_validate(reg)


@router.post("/cash-register/open", response_model=CashRegisterResponse)
def open_register(
    payload: OpenCashRegisterRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Abre una caja para el usuario actual."""
    _ensure_member(db, store, user)

    existing = _open_register(db, store.id, user.id)
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Ya tenés una caja abierta. Cerrala antes de abrir otra.",
        )

    reg = CashRegister(
        store_id=store.id,
        user_id=user.id,
        opened_at=datetime.now(timezone.utc),
        opening_cash=_decimal(payload.opening_cash),
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    log_action(
        db, "cash_register.opened",
        user_id=user.id, store_id=store.id,
        resource_type="cash_register", resource_id=reg.id,
        details={"opening_cash": str(payload.opening_cash)},
    )
    return CashRegisterResponse.model_validate(reg)


@router.post("/cash-register/close", response_model=CashRegisterResponse)
def close_register(
    payload: CloseCashRegisterRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cierra la caja del usuario con cuadre (counted vs expected)."""
    _ensure_member(db, store, user)

    reg = _open_register(db, store.id, user.id)
    if not reg:
        raise HTTPException(status_code=404, detail="No hay caja abierta")

    # Calcular efectivo esperado: opening_cash + ventas en efectivo de esta caja
    cash_method_ids = [
        m.id for m in db.query(PaymentMethod).filter(
            PaymentMethod.store_id == store.id,
            PaymentMethod.provider == "efectivo",
        ).all()
    ]
    cash_sales_total = Decimal("0")
    if cash_method_ids:
        rows = (
            db.query(Order.total)
            .filter(
                Order.cash_register_id == reg.id,
                Order.payment_method_id.in_(cash_method_ids),
                Order.status != "cancelled",
            )
            .all()
        )
        for (total,) in rows:
            cash_sales_total += _decimal(total)

    expected = _decimal(reg.opening_cash) + cash_sales_total
    counted = _decimal(payload.counted_cash)

    # Total de ventas de la caja (todas, no solo efectivo)
    sales_rows = (
        db.query(Order.total)
        .filter(
            Order.cash_register_id == reg.id,
            Order.status != "cancelled",
        )
        .all()
    )
    sales_count = len(sales_rows)
    sales_total = sum((_decimal(r[0]) for r in sales_rows), Decimal("0"))

    reg.closed_at = datetime.now(timezone.utc)
    reg.expected_cash = expected
    reg.counted_cash = counted
    reg.cash_difference = counted - expected
    reg.sales_count = sales_count
    reg.sales_total = sales_total
    reg.notes = payload.notes
    db.add(reg)
    db.commit()
    db.refresh(reg)

    log_action(
        db, "cash_register.closed",
        user_id=user.id, store_id=store.id,
        resource_type="cash_register", resource_id=reg.id,
        details={
            "expected": str(expected),
            "counted": str(counted),
            "difference": str(counted - expected),
            "sales_total": str(sales_total),
            "sales_count": sales_count,
        },
    )
    return CashRegisterResponse.model_validate(reg)


# ════════════════════════════════════════════════════════════════════
#  POS sale (crear venta)
# ════════════════════════════════════════════════════════════════════

def _generate_order_number() -> str:
    return f"POS-{str(uuid4())[:8].upper()}"


@router.post("/sale", response_model=POSSaleResponse)
def create_pos_sale(
    payload: POSSaleRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Registra una venta del POS. Crea Order + OrderItems, descuenta stock,
    asocia caja del usuario (si tiene una abierta).
    """
    _ensure_member(db, store, user)

    if not payload.items:
        raise HTTPException(status_code=400, detail="La venta no tiene items")

    # Caja abierta del usuario (opcional)
    cash_register = _open_register(db, store.id, user.id)

    # Validar customer (si vino)
    customer_id = payload.customer_id
    if customer_id:
        cust = db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.store_id == store.id,
        ).first()
        if not cust:
            raise HTTPException(status_code=400, detail="Cliente no encontrado")

    # Validar payment method (si vino)
    payment_method: PaymentMethod | None = None
    if payload.payment_method_id:
        payment_method = db.query(PaymentMethod).filter(
            PaymentMethod.id == payload.payment_method_id,
            PaymentMethod.store_id == store.id,
        ).first()
        if not payment_method:
            raise HTTPException(status_code=400, detail="Método de pago no válido")

    # ── Construir items, validar stock, calcular totales ──
    subtotal = Decimal("0")
    order_items: list[OrderItem] = []
    stock_changes: list[tuple[Product | ProductVariant, int]] = []

    for item in payload.items:
        product = db.query(Product).filter(
            Product.id == item.product_id,
            Product.store_id == store.id,
            Product.is_active == True,
        ).first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Producto {item.product_id} no encontrado")

        variant: ProductVariant | None = None
        unit_price = item.unit_price if item.unit_price is not None else product.price
        unit_price = _decimal(unit_price)
        item_name = product.name

        if item.variant_id:
            variant = db.query(ProductVariant).filter(
                ProductVariant.id == item.variant_id,
                ProductVariant.product_id == product.id,
            ).first()
            if not variant:
                raise HTTPException(status_code=400, detail=f"Variante {item.variant_id} no encontrada")
            if item.unit_price is None and variant.price:
                unit_price = _decimal(variant.price)
            item_name = f"{product.name} — {variant.name}"

        # Validación de stock
        if variant and variant.track_inventory:
            if (variant.stock_quantity or 0) < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {item_name} (disponible: {variant.stock_quantity})",
                )
            stock_changes.append((variant, item.quantity))
        elif product.track_inventory and not variant:
            if not product.allow_backorder and (product.stock_quantity or 0) < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {item_name} (disponible: {product.stock_quantity})",
                )
            stock_changes.append((product, item.quantity))

        line_total = unit_price * item.quantity
        subtotal += line_total

        order_items.append(OrderItem(
            product_id=product.id,
            variant_id=variant.id if variant else None,
            name=item_name,
            sku=(variant.sku if variant else product.sku) or "",
            quantity=item.quantity,
            unit_price=unit_price,
            total_price=line_total,
        ))

    discount = _decimal(payload.discount_amount)
    shipping = _decimal(payload.shipping_amount)
    total = subtotal - discount + shipping
    if total < 0:
        total = Decimal("0")

    # ── Determinar payment_status según provider ──
    # cash / manual_external / manual_transfer → "paid" si vino payment_received,
    # sino "pending"
    # digital_redirect → "pending" (el webhook lo marca paid)
    payment_status = "pending"
    change_due: Decimal | None = None
    redirect_url: str | None = None

    if payment_method:
        provider_key = payment_method.provider
        if provider_key == "efectivo":
            received = _decimal(payload.payment_received) if payload.payment_received is not None else total
            if received < total:
                raise HTTPException(
                    status_code=400,
                    detail=f"Efectivo recibido (${received}) menor al total (${total})",
                )
            change_due = received - total
            payment_status = "paid"
        elif provider_key in ("tarjeta_externa", "modo", "tigo_money", "personal_pay", "bancard_qr", "oxxo", "webpay"):
            payment_status = "paid"  # confiamos en que el cobro externo se hizo
        elif provider_key in ("transferencia", "pix", "ueno_bank", "sudameris", "gnb", "spei"):
            payment_status = "pending_verification" if not payload.payment_proof else "paid"
        elif provider_key in ("mercadopago", "stripe", "paypal"):
            # TODO POS-2: generar redirect_url con la API real
            payment_status = "pending"
            redirect_url = None
        else:
            payment_status = "pending"

    # ── Crear la Order ──
    order = Order(
        store_id=store.id,
        customer_id=customer_id,
        order_number=_generate_order_number(),
        status="confirmed" if payment_status == "paid" else "pending",
        subtotal=subtotal,
        shipping_amount=shipping,
        discount_amount=discount,
        total=total,
        currency=store.currency or "USD",
        notes=payload.notes,
        source="pos",
        payment_method_id=payment_method.id if payment_method else None,
        payment_status=payment_status,
        payment_received=_decimal(payload.payment_received) if payload.payment_received is not None else None,
        payment_proof=payload.payment_proof,
        created_by_user_id=user.id,
        cash_register_id=cash_register.id if cash_register else None,
        items=order_items,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # ── Descontar stock ──
    for entity, qty in stock_changes:
        entity.stock_quantity = (entity.stock_quantity or 0) - qty
        db.add(entity)

    # ── Si vino con from_conversation_id, marcar la conversación como "completed" ──
    if payload.from_conversation_id:
        conv = (
            db.query(Conversation)
            .filter(
                Conversation.id == payload.from_conversation_id,
                Conversation.store_id == store.id,
            )
            .first()
        )
        if conv:
            conv.outcome = "sale_completed"
            conv.outcome_reason = f"convertida en orden POS {order.order_number}"
            conv.estimated_value = total
            db.add(conv)

    db.commit()

    log_action(
        db, "pos.sale_created",
        user_id=user.id, store_id=store.id,
        resource_type="order", resource_id=order.id,
        details={
            "order_number": order.order_number,
            "total": str(total),
            "items": len(order_items),
            "payment_method": payment_method.provider if payment_method else None,
            "payment_status": payment_status,
        },
    )

    return POSSaleResponse(
        order_id=order.id,
        order_number=order.order_number,
        subtotal=subtotal,
        discount=discount,
        shipping=shipping,
        total=total,
        payment_status=payment_status,
        change_due=change_due,
        payment_redirect_url=redirect_url,
    )


# ════════════════════════════════════════════════════════════════════
#  Refund (devolución)
# ════════════════════════════════════════════════════════════════════

@router.post("/orders/{order_id}/refund", response_model=RefundResponse)
def refund_order(
    order_id: str,
    payload: RefundRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devolución total o parcial. Si es total: cancela la orden y repone stock.
    Si es parcial: solo registra el monto refundeado.
    """
    role = _ensure_member(db, store, user)
    if role not in {RoleEnum.OWNER.value, RoleEnum.ADMIN.value, RoleEnum.MANAGER.value}:
        raise HTTPException(status_code=403, detail="Solo manager+ pueden hacer devoluciones")

    order = db.query(Order).filter(
        Order.id == order_id, Order.store_id == store.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.status == "cancelled":
        raise HTTPException(status_code=400, detail="La orden ya está cancelada")

    is_full = payload.amount is None or _decimal(payload.amount) >= _decimal(order.total)
    amount = _decimal(order.total) if is_full else _decimal(payload.amount)

    refund = Refund(
        store_id=store.id,
        order_id=order.id,
        refunded_by_user_id=user.id,
        amount=amount,
        reason=payload.reason,
        is_full_refund=is_full,
    )
    db.add(refund)

    if is_full:
        # Reponer stock + cancelar orden
        for item in order.items:
            if item.variant_id:
                variant = db.query(ProductVariant).filter(ProductVariant.id == item.variant_id).first()
                if variant:
                    variant.stock_quantity = (variant.stock_quantity or 0) + item.quantity
                    db.add(variant)
            elif item.product_id:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    product.stock_quantity = (product.stock_quantity or 0) + item.quantity
                    db.add(product)
        order.status = "cancelled"
        order.payment_status = "refunded"
    else:
        order.payment_status = "partial_refund"

    db.add(order)
    db.commit()
    db.refresh(refund)

    log_action(
        db, "pos.refund_created",
        user_id=user.id, store_id=store.id,
        resource_type="order", resource_id=order.id,
        details={"amount": str(amount), "is_full": is_full, "reason": payload.reason},
    )

    return RefundResponse.model_validate(refund)
