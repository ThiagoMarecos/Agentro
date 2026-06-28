"""
Servicio de Discounts — orquesta Stripe Coupons + persistencia local.

Por qué la capa local existe:
  - Stripe es la fuente de verdad de la PLATA, pero no recuerda QUIÉN aplicó
    el descuento ni POR QUÉ (campo `reason`).
  - Para listar descuentos vigentes con filtros y joins (por store, por motivo,
    etc.) sin pegarle a Stripe en cada render.

Reglas:
  - Cada Discount local = 1 Stripe Coupon + 1 Stripe Customer Discount.
  - Si el super admin cancela el descuento, marcamos status='canceled' en DB
    Y removemos el Discount en Stripe (no el Coupon, que queda como template).
"""

import logging
import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.discount import Discount
from app.models.store import Store
from app.models.user import User
from app.services import stripe_billing

logger = logging.getLogger(__name__)


def _generate_coupon_id(reason: str) -> str:
    """ID único legible para Stripe Coupon (max 100 chars)."""
    # Slug corto del reason + 6 chars random para evitar colisiones
    reason_slug = "".join(c for c in reason.lower() if c.isalnum() or c == "-")[:30]
    suffix = secrets.token_urlsafe(4)[:6]
    return f"agentro-{reason_slug}-{suffix}" if reason_slug else f"agentro-{suffix}"


def apply_discount(
    db: Session,
    store: Store,
    applied_by: User,
    discount_type: str,
    discount_value: int,
    duration: str,
    duration_in_months: int | None,
    reason: str,
) -> Discount:
    """
    Crea un Stripe Coupon, lo aplica como Discount al Customer de la store,
    y persiste el registro en DB.

    Args:
      discount_type: 'percent' (1-100) | 'amount' (centavos USD)
      duration: 'once' | 'repeating' | 'forever'
      duration_in_months: requerido si duration='repeating'
      reason: motivo INTERNO obligatorio para auditoría
    """
    if discount_type not in ("percent", "amount"):
        raise ValueError("discount_type debe ser 'percent' o 'amount'")
    if duration not in ("once", "repeating", "forever"):
        raise ValueError("duration debe ser 'once' | 'repeating' | 'forever'")
    if duration == "repeating" and not duration_in_months:
        raise ValueError("duration_in_months requerido cuando duration='repeating'")
    if not reason or not reason.strip():
        raise ValueError("reason es obligatorio para auditoría")
    if discount_type == "percent" and not (1 <= discount_value <= 100):
        raise ValueError("percent debe estar entre 1 y 100")
    if discount_type == "amount" and discount_value < 1:
        raise ValueError("amount debe ser > 0 centavos")
    if not store.stripe_customer_id:
        raise RuntimeError(
            "Store no tiene Stripe Customer todavía (no hizo checkout). "
            "Aplicar descuentos solo a stores con suscripción."
        )

    stripe = stripe_billing._stripe()
    coupon_id = _generate_coupon_id(reason)

    # 1) Crear Coupon en Stripe
    coupon_kwargs: dict = {
        "id": coupon_id,
        "duration": duration,
        "metadata": {
            "store_id": store.id,
            "reason": reason[:500],
            "applied_by": applied_by.id,
        },
    }
    if duration == "repeating":
        coupon_kwargs["duration_in_months"] = duration_in_months
    if discount_type == "percent":
        coupon_kwargs["percent_off"] = discount_value
    else:
        coupon_kwargs["amount_off"] = discount_value
        coupon_kwargs["currency"] = "usd"

    coupon = stripe.Coupon.create(**coupon_kwargs)

    # 2) Aplicar al Customer (creará Discount automático en su subscription activa)
    stripe.Customer.modify(store.stripe_customer_id, coupon=coupon.id)

    # 3) Recuperar el discount ID actual del customer (post-aplicación)
    customer = stripe.Customer.retrieve(store.stripe_customer_id)
    discount_id = (customer.get("discount") or {}).get("id") if isinstance(customer.get("discount"), dict) else None

    # 4) Persistir local
    discount = Discount(
        store_id=store.id,
        applied_by_user_id=applied_by.id,
        stripe_coupon_id=coupon.id,
        stripe_discount_id=discount_id,
        discount_type=discount_type,
        discount_value=discount_value,
        duration=duration,
        duration_in_months=duration_in_months,
        reason=reason.strip(),
        status="active",
    )
    db.add(discount)
    db.commit()
    db.refresh(discount)

    logger.info(
        f"[discounts] Aplicado a store={store.id} type={discount_type} "
        f"value={discount_value} dur={duration} reason={reason!r}"
    )
    return discount


def cancel_discount(db: Session, discount: Discount) -> Discount:
    """Cancela el descuento aplicado: lo remueve del customer en Stripe + marca local."""
    if discount.status != "active":
        raise ValueError(f"Discount ya está {discount.status}, no se puede cancelar")

    stripe = stripe_billing._stripe()
    # Remover el discount del customer (no borra el Coupon, queda como template)
    store = discount.store
    if store and store.stripe_customer_id:
        try:
            stripe.Customer.delete_discount(store.stripe_customer_id)
        except Exception as e:
            # Si Stripe falla (ej. ya estaba removido) seguimos y marcamos local
            logger.warning(f"[discounts] Stripe delete_discount falló: {e}")

    discount.status = "canceled"
    discount.canceled_at = datetime.now(timezone.utc)
    db.add(discount)
    db.commit()
    db.refresh(discount)
    logger.info(f"[discounts] Cancelado discount={discount.id} store={discount.store_id}")
    return discount
