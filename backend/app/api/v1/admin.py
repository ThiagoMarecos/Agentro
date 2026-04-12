"""
Endpoints del Super Admin de Nexora.
Acceso exclusivo para usuarios con is_superadmin=True.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.store import Store, StoreMember
from app.models.product import Product
from app.models.order import Order
from app.models.customer import Customer
from app.models.ai import AIChannel
from app.models.audit import AuditLog
from app.core.dependencies import require_superadmin
from app.services import evolution_api

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────

class DashboardResponse(BaseModel):
    total_stores: int
    active_stores: int
    suspended_stores: int
    total_users: int
    whatsapp_connected: int
    recent_stores: list[dict]


class StoreListItem(BaseModel):
    id: str
    name: str
    slug: str
    is_active: bool
    created_at: str
    owner_email: str | None
    has_whatsapp: bool

    class Config:
        from_attributes = True


class StoreListResponse(BaseModel):
    stores: list[StoreListItem]
    total: int
    page: int
    page_size: int


class StoreDetailResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    industry: str | None
    country: str | None
    currency: str | None
    is_active: bool
    created_at: str
    owner_email: str | None
    whatsapp_status: str | None
    whatsapp_number: str | None
    product_count: int
    order_count: int
    customer_count: int


class StatusUpdate(BaseModel):
    is_active: bool


class ActivityItem(BaseModel):
    id: str
    action: str
    resource_type: str | None
    details: str | None
    created_at: str
    user_email: str | None


# ── Helpers ──────────────────────────────────────────────────────────

def _get_owner_email(db: Session, store_id: str) -> str | None:
    member = db.query(StoreMember).filter(
        StoreMember.store_id == store_id,
        StoreMember.role == "owner",
    ).first()
    if member:
        user = db.query(User).filter(User.id == member.user_id).first()
        return user.email if user else None
    return None


def _get_whatsapp_channel(db: Session, store_id: str) -> AIChannel | None:
    return db.query(AIChannel).filter(
        AIChannel.store_id == store_id,
        AIChannel.channel_type == "whatsapp",
    ).first()


async def _sync_whatsapp_status(db: Session, channel: AIChannel) -> AIChannel:
    """Sincroniza el estado de WhatsApp con Evolution API en tiempo real."""
    if not channel or not channel.instance_name:
        return channel
    try:
        state = await evolution_api.get_connection_state(channel.instance_name)
        live_state = state.get("state", "")
        if live_state == "open":
            channel.connection_status = "connected"
        elif live_state == "connecting":
            channel.connection_status = "connecting"
        elif live_state == "close":
            channel.connection_status = "disconnected"

        info = await evolution_api.fetch_instance(channel.instance_name)
        if info:
            owner = info.get("ownerJid", "") or ""
            if "@" in owner and not channel.whatsapp_number:
                channel.whatsapp_number = owner.split("@")[0]

        db.commit()
        db.refresh(channel)
    except Exception:
        pass
    return channel


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
def admin_dashboard(
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Métricas generales del Super Admin."""
    total_stores = db.query(func.count(Store.id)).scalar() or 0
    active_stores = db.query(func.count(Store.id)).filter(Store.is_active == True).scalar() or 0
    suspended_stores = total_stores - active_stores
    total_users = db.query(func.count(User.id)).scalar() or 0
    whatsapp_connected = db.query(func.count(AIChannel.id)).filter(
        AIChannel.channel_type == "whatsapp",
        AIChannel.connection_status.in_(["open", "connected"]),
    ).scalar() or 0

    recent = db.query(Store).order_by(Store.created_at.desc()).limit(5).all()
    recent_stores = []
    for s in recent:
        recent_stores.append({
            "id": s.id,
            "name": s.name,
            "slug": s.slug,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat() if s.created_at else "",
            "owner_email": _get_owner_email(db, s.id),
        })

    return DashboardResponse(
        total_stores=total_stores,
        active_stores=active_stores,
        suspended_stores=suspended_stores,
        total_users=total_users,
        whatsapp_connected=whatsapp_connected,
        recent_stores=recent_stores,
    )


@router.get("/stores", response_model=StoreListResponse)
def admin_list_stores(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    status: str = Query("all"),
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Lista todas las tiendas con paginación, búsqueda y filtro de estado."""
    q = db.query(Store)

    if search:
        q = q.filter(Store.name.ilike(f"%{search}%"))

    if status == "active":
        q = q.filter(Store.is_active == True)
    elif status == "suspended":
        q = q.filter(Store.is_active == False)

    total = q.count()
    stores_db = q.order_by(Store.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s in stores_db:
        wa = _get_whatsapp_channel(db, s.id)
        items.append(StoreListItem(
            id=s.id,
            name=s.name,
            slug=s.slug,
            is_active=s.is_active,
            created_at=s.created_at.isoformat() if s.created_at else "",
            owner_email=_get_owner_email(db, s.id),
            has_whatsapp=wa is not None and wa.connection_status in ("open", "connected"),
        ))

    return StoreListResponse(stores=items, total=total, page=page, page_size=page_size)


@router.get("/stores/{store_id}", response_model=StoreDetailResponse)
async def admin_store_detail(
    store_id: str,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Detalle de una tienda específica, con estado de WhatsApp en tiempo real."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    wa = _get_whatsapp_channel(db, store.id)
    if wa:
        wa = await _sync_whatsapp_status(db, wa)

    product_count = db.query(func.count(Product.id)).filter(Product.store_id == store.id).scalar() or 0
    order_count = db.query(func.count(Order.id)).filter(Order.store_id == store.id).scalar() or 0
    customer_count = db.query(func.count(Customer.id)).filter(Customer.store_id == store.id).scalar() or 0

    return StoreDetailResponse(
        id=store.id,
        name=store.name,
        slug=store.slug,
        description=store.description,
        industry=store.industry,
        country=store.country,
        currency=store.currency,
        is_active=store.is_active,
        created_at=store.created_at.isoformat() if store.created_at else "",
        owner_email=_get_owner_email(db, store.id),
        whatsapp_status=wa.connection_status if wa else None,
        whatsapp_number=wa.whatsapp_number if wa else None,
        product_count=product_count,
        order_count=order_count,
        customer_count=customer_count,
    )


@router.patch("/stores/{store_id}/status")
def admin_update_store_status(
    store_id: str,
    body: StatusUpdate,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Suspender o activar una tienda."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    store.is_active = body.is_active
    db.commit()

    action = "store_activated" if body.is_active else "store_suspended"
    log = AuditLog(
        store_id=store.id,
        user_id=admin.id,
        action=action,
        resource_type="store",
        resource_id=store.id,
        details=f"Super Admin {'activó' if body.is_active else 'suspendió'} la tienda {store.name}",
    )
    db.add(log)
    db.commit()

    return {"ok": True, "is_active": store.is_active}


@router.get("/stores/{store_id}/activity", response_model=list[ActivityItem])
def admin_store_activity(
    store_id: str,
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Últimas acciones de auditoría de una tienda."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    logs = db.query(AuditLog).filter(
        AuditLog.store_id == store_id,
    ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    items = []
    for log in logs:
        user_email = None
        if log.user_id:
            u = db.query(User).filter(User.id == log.user_id).first()
            user_email = u.email if u else None
        items.append(ActivityItem(
            id=log.id,
            action=log.action,
            resource_type=log.resource_type,
            details=log.details,
            created_at=log.created_at.isoformat() if log.created_at else "",
            user_email=user_email,
        ))

    return items
