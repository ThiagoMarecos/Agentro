"""
Super admin — gestión de descuentos sobre suscripciones SaaS.

Solo acceso para is_superadmin=True.

Endpoints:
  GET    /admin/discounts                    — listar (filtros opcionales)
  POST   /admin/discounts                    — aplicar nuevo descuento a una store
  DELETE /admin/discounts/{id}               — cancelar descuento activo
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import require_superadmin
from app.db.session import get_db
from app.models.discount import Discount
from app.models.store import Store
from app.models.user import User
from app.services import discounts_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
#  Schemas
# ════════════════════════════════════════════════════════════════════

class ApplyDiscountRequest(BaseModel):
    store_id: str = Field(description="ID de la store que recibe el descuento")
    discount_type: str = Field(description="'percent' (1-100) o 'amount' (centavos USD)")
    discount_value: int = Field(gt=0, description="Si percent: 1-100; si amount: centavos USD")
    duration: str = Field(description="'once' | 'repeating' | 'forever'")
    duration_in_months: int | None = Field(None, description="Requerido si duration='repeating'")
    reason: str = Field(min_length=3, max_length=500, description="Motivo interno (obligatorio)")


class DiscountResponse(BaseModel):
    id: str
    store_id: str
    store_name: str | None
    store_slug: str | None
    applied_by_user_id: str | None
    applied_by_email: str | None
    stripe_coupon_id: str
    stripe_discount_id: str | None
    discount_type: str
    discount_value: int
    duration: str
    duration_in_months: int | None
    reason: str
    status: str
    expires_at: str | None
    canceled_at: str | None
    created_at: str


def _serialize(discount: Discount) -> DiscountResponse:
    return DiscountResponse(
        id=discount.id,
        store_id=discount.store_id,
        store_name=discount.store.name if discount.store else None,
        store_slug=discount.store.slug if discount.store else None,
        applied_by_user_id=discount.applied_by_user_id,
        applied_by_email=discount.applied_by.email if discount.applied_by else None,
        stripe_coupon_id=discount.stripe_coupon_id,
        stripe_discount_id=discount.stripe_discount_id,
        discount_type=discount.discount_type,
        discount_value=discount.discount_value,
        duration=discount.duration,
        duration_in_months=discount.duration_in_months,
        reason=discount.reason,
        status=discount.status,
        expires_at=discount.expires_at.isoformat() if discount.expires_at else None,
        canceled_at=discount.canceled_at.isoformat() if discount.canceled_at else None,
        created_at=discount.created_at.isoformat() if discount.created_at else "",
    )


# ════════════════════════════════════════════════════════════════════
#  Endpoints
# ════════════════════════════════════════════════════════════════════

@router.get("", response_model=list[DiscountResponse])
def list_discounts(
    status: str | None = Query(None, description="Filtrar por status: active|canceled|expired"),
    store_id: str | None = Query(None),
    user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Lista todos los descuentos (con filtros opcionales)."""
    query = db.query(Discount)
    if status:
        query = query.filter(Discount.status == status)
    if store_id:
        query = query.filter(Discount.store_id == store_id)
    discounts = query.order_by(Discount.created_at.desc()).all()
    return [_serialize(d) for d in discounts]


@router.post("", response_model=DiscountResponse)
def apply_discount(
    payload: ApplyDiscountRequest,
    user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """
    Aplica un nuevo descuento a la store. Crea un Stripe Coupon y lo aplica
    al Customer. El motivo es obligatorio para auditoría.
    """
    store = db.query(Store).filter(Store.id == payload.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store no encontrada")

    try:
        discount = discounts_service.apply_discount(
            db=db,
            store=store,
            applied_by=user,
            discount_type=payload.discount_type,
            discount_value=payload.discount_value,
            duration=payload.duration,
            duration_in_months=payload.duration_in_months,
            reason=payload.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[admin-discounts] error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error aplicando descuento")
    return _serialize(discount)


@router.delete("/{discount_id}", response_model=DiscountResponse)
def cancel_discount(
    discount_id: str,
    user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Cancela un descuento activo. Próximo cobro vuelve a precio full."""
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Descuento no encontrado")
    try:
        canceled = discounts_service.cancel_discount(db, discount)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _serialize(canceled)
