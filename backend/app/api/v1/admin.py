"""
Endpoints del Super Admin de Agentro.
Acceso exclusivo para usuarios con is_superadmin=True.
"""

import logging
from datetime import datetime, timezone

import redis
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.store import Store, StoreMember
from app.models.product import Product
from app.models.order import Order
from app.models.customer import Customer
from app.models.ai import AIChannel, AIAgent
from app.models.audit import AuditLog
from app.core.dependencies import require_superadmin
from app.config import get_settings, get_dynamic_setting
from app.services import evolution_api

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────

class SaaSFinancials(BaseModel):
    gmv_today: float          # Gross Merchandise Volume hoy (total vendido todas las tiendas)
    gmv_week: float           # GMV últimos 7 días
    gmv_month: float          # GMV últimos 30 días
    gmv_all_time: float       # GMV histórico
    commission_percent: float  # % de comisión
    revenue_today: float      # Ingresos Agentro hoy (GMV * comisión)
    revenue_week: float
    revenue_month: float
    revenue_all_time: float
    orders_today: int
    orders_week: int
    orders_month: int
    orders_all_time: int
    avg_order_value: float    # Ticket promedio
    top_stores: list[dict]    # Top 5 tiendas por ventas del mes


class DashboardResponse(BaseModel):
    total_stores: int
    active_stores: int
    suspended_stores: int
    total_users: int
    whatsapp_connected: int
    stores_today: int         # Tiendas registradas hoy
    stores_week: int          # Tiendas registradas esta semana
    recent_stores: list[dict]
    financials: SaaSFinancials


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


class UserListItem(BaseModel):
    id: str
    email: str
    full_name: str | None
    is_active: bool
    is_superadmin: bool
    auth_provider: str | None
    created_at: str
    last_login_at: str | None
    store_count: int


class UserListResponse(BaseModel):
    users: list[UserListItem]
    total: int
    page: int
    page_size: int


class PlatformLogItem(BaseModel):
    id: str
    action: str
    resource_type: str | None
    details: str | None
    created_at: str
    user_email: str | None
    store_name: str | None


class PlatformLogResponse(BaseModel):
    logs: list[PlatformLogItem]
    total: int
    page: int
    page_size: int


class ServiceHealth(BaseModel):
    name: str
    status: str  # "ok" | "error" | "degraded"
    latency_ms: float | None
    details: str | None
    actions: list[str] | None = None  # acciones recomendadas


class VPSResources(BaseModel):
    cpu_percent: float
    memory_used_mb: float
    memory_total_mb: float
    memory_percent: float
    disk_used_gb: float
    disk_total_gb: float
    disk_percent: float
    uptime_seconds: float
    load_avg_1m: float
    load_avg_5m: float
    load_avg_15m: float


class HealthResponse(BaseModel):
    overall: str
    services: list[ServiceHealth]
    vps: VPSResources | None = None


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
    """Métricas generales del Super Admin con datos financieros del SaaS."""
    from app.services.platform_settings_service import get_setting_value

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Retroceder al lunes
    from datetime import timedelta
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Contadores básicos ──
    total_stores = db.query(func.count(Store.id)).scalar() or 0
    active_stores = db.query(func.count(Store.id)).filter(Store.is_active == True).scalar() or 0
    suspended_stores = total_stores - active_stores
    total_users = db.query(func.count(User.id)).scalar() or 0
    whatsapp_connected = db.query(func.count(AIChannel.id)).filter(
        AIChannel.channel_type == "whatsapp",
        AIChannel.connection_status.in_(["open", "connected"]),
    ).scalar() or 0

    # Tiendas nuevas
    stores_today = db.query(func.count(Store.id)).filter(Store.created_at >= today_start).scalar() or 0
    stores_week = db.query(func.count(Store.id)).filter(Store.created_at >= week_start).scalar() or 0

    # ── Financials ──
    # Comisión desde settings
    commission_str = get_setting_value(db, "saas_commission_percent") or "0"
    try:
        commission_percent = float(commission_str)
    except ValueError:
        commission_percent = 0.0

    # Filtro: solo órdenes no canceladas
    valid_statuses = ["pending", "confirmed", "processing", "shipped", "delivered"]

    def _gmv_query(since=None):
        q = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
            Order.status.in_(valid_statuses)
        )
        if since:
            q = q.filter(Order.created_at >= since)
        return float(q.scalar() or 0)

    def _order_count(since=None):
        q = db.query(func.count(Order.id)).filter(
            Order.status.in_(valid_statuses)
        )
        if since:
            q = q.filter(Order.created_at >= since)
        return q.scalar() or 0

    gmv_today = _gmv_query(today_start)
    gmv_week = _gmv_query(week_start)
    gmv_month = _gmv_query(month_start)
    gmv_all_time = _gmv_query()

    orders_today = _order_count(today_start)
    orders_week = _order_count(week_start)
    orders_month = _order_count(month_start)
    orders_all_time = _order_count()

    avg_order_value = round(gmv_all_time / orders_all_time, 2) if orders_all_time > 0 else 0

    commission_rate = commission_percent / 100

    # Top 5 tiendas por ventas del mes
    top_stores_q = (
        db.query(
            Store.id,
            Store.name,
            Store.slug,
            func.coalesce(func.sum(Order.total), 0).label("total_sales"),
            func.count(Order.id).label("order_count"),
        )
        .join(Order, Order.store_id == Store.id)
        .filter(
            Order.status.in_(valid_statuses),
            Order.created_at >= month_start,
        )
        .group_by(Store.id, Store.name, Store.slug)
        .order_by(func.sum(Order.total).desc())
        .limit(5)
        .all()
    )

    top_stores = []
    for row in top_stores_q:
        total_sales = float(row.total_sales)
        top_stores.append({
            "id": row.id,
            "name": row.name,
            "slug": row.slug,
            "total_sales": round(total_sales, 2),
            "order_count": row.order_count,
            "commission": round(total_sales * commission_rate, 2),
        })

    financials = SaaSFinancials(
        gmv_today=round(gmv_today, 2),
        gmv_week=round(gmv_week, 2),
        gmv_month=round(gmv_month, 2),
        gmv_all_time=round(gmv_all_time, 2),
        commission_percent=commission_percent,
        revenue_today=round(gmv_today * commission_rate, 2),
        revenue_week=round(gmv_week * commission_rate, 2),
        revenue_month=round(gmv_month * commission_rate, 2),
        revenue_all_time=round(gmv_all_time * commission_rate, 2),
        orders_today=orders_today,
        orders_week=orders_week,
        orders_month=orders_month,
        orders_all_time=orders_all_time,
        avg_order_value=avg_order_value,
        top_stores=top_stores,
    )

    # ── Últimas tiendas ──
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
        stores_today=stores_today,
        stores_week=stores_week,
        recent_stores=recent_stores,
        financials=financials,
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


# ── Usuarios ────────────────────────────────────────────────────────

@router.get("/users", response_model=UserListResponse)
def admin_list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=100),
    status: str = Query("all"),
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Lista todos los usuarios de la plataforma."""
    q = db.query(User)

    if search:
        q = q.filter(
            (User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%"))
        )

    if status == "active":
        q = q.filter(User.is_active == True)
    elif status == "suspended":
        q = q.filter(User.is_active == False)

    total = q.count()
    users_db = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for u in users_db:
        store_count = db.query(func.count(StoreMember.id)).filter(
            StoreMember.user_id == u.id
        ).scalar() or 0
        items.append(UserListItem(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_superadmin=u.is_superadmin,
            auth_provider=u.auth_provider,
            created_at=u.created_at.isoformat() if u.created_at else "",
            last_login_at=u.last_login_at.isoformat() if u.last_login_at else None,
            store_count=store_count,
        ))

    return UserListResponse(users=items, total=total, page=page, page_size=page_size)


@router.patch("/users/{user_id}/status")
def admin_update_user_status(
    user_id: str,
    body: StatusUpdate,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Suspender o activar un usuario."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.is_superadmin:
        raise HTTPException(status_code=400, detail="No se puede modificar un Super Admin")

    user.is_active = body.is_active
    db.commit()

    log = AuditLog(
        user_id=admin.id,
        action="user_activated" if body.is_active else "user_suspended",
        resource_type="user",
        resource_id=user.id,
        details=f"Super Admin {'activó' if body.is_active else 'suspendió'} al usuario {user.email}",
    )
    db.add(log)
    db.commit()

    return {"ok": True, "is_active": user.is_active}


class PromoteRequest(BaseModel):
    email: str


@router.post("/users/promote-superadmin")
def admin_promote_superadmin(
    body: PromoteRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Promover un usuario a Super Admin por email."""
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"Usuario con email {body.email} no encontrado")
    if user.is_superadmin:
        return {"ok": True, "message": f"{body.email} ya es Super Admin"}

    user.is_superadmin = True
    db.commit()

    log = AuditLog(
        user_id=admin.id,
        action="user_promoted_superadmin",
        resource_type="user",
        resource_id=user.id,
        details=f"Super Admin promovió a {user.email} como Super Admin",
    )
    db.add(log)
    db.commit()

    return {"ok": True, "message": f"{body.email} ahora es Super Admin"}


# ── Logs de plataforma ─────────────────────────────────────────────

@router.get("/logs", response_model=PlatformLogResponse)
def admin_platform_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    action_filter: str = Query("", max_length=100),
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Logs de auditoría de toda la plataforma."""
    q = db.query(AuditLog)

    if action_filter:
        q = q.filter(AuditLog.action.ilike(f"%{action_filter}%"))

    total = q.count()
    logs_db = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for log in logs_db:
        user_email = None
        if log.user_id:
            u = db.query(User).filter(User.id == log.user_id).first()
            user_email = u.email if u else None

        store_name = None
        if log.store_id:
            s = db.query(Store).filter(Store.id == log.store_id).first()
            store_name = s.name if s else None

        items.append(PlatformLogItem(
            id=log.id,
            action=log.action,
            resource_type=log.resource_type,
            details=log.details,
            created_at=log.created_at.isoformat() if log.created_at else "",
            user_email=user_email,
            store_name=store_name,
        ))

    return PlatformLogResponse(logs=items, total=total, page=page, page_size=page_size)


# ── Salud del sistema ──────────────────────────────────────────────

def _get_vps_resources() -> VPSResources | None:
    """Lee recursos del sistema operativo."""
    try:
        import psutil, time as _time
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        load = psutil.getloadavg()
        return VPSResources(
            cpu_percent=psutil.cpu_percent(interval=0.5),
            memory_used_mb=round(mem.used / (1024 * 1024), 1),
            memory_total_mb=round(mem.total / (1024 * 1024), 1),
            memory_percent=mem.percent,
            disk_used_gb=round(disk.used / (1024 ** 3), 1),
            disk_total_gb=round(disk.total / (1024 ** 3), 1),
            disk_percent=round(disk.used / disk.total * 100, 1),
            uptime_seconds=round(_time.time() - psutil.boot_time()),
            load_avg_1m=load[0],
            load_avg_5m=load[1],
            load_avg_15m=load[2],
        )
    except Exception:
        return None


def _recommend_actions(service: str, status: str, details: str | None) -> list[str]:
    """Genera acciones recomendadas según el servicio y su estado."""
    if status == "ok":
        return []

    actions_map = {
        "PostgreSQL": {
            "error": [
                "Verificar que el container agentro-postgres esté corriendo: docker ps",
                "Revisar logs: docker logs agentro-postgres --tail 50",
                "Reiniciar container: docker restart agentro-postgres",
                "Verificar espacio en disco del VPS",
            ],
        },
        "Redis": {
            "error": [
                "Verificar container: docker ps | grep redis",
                "Reiniciar Redis: docker restart agentro-redis",
                "Verificar REDIS_URL en .env del backend",
                "Revisar logs: docker logs agentro-redis --tail 50",
            ],
        },
        "Evolution API": {
            "error": [
                "Configurar Evolution API URL y Key en Admin > API Keys",
                "Verificar container: docker ps | grep evolution",
                "Reiniciar: docker restart agentro-evolution",
                "Revisar logs: docker logs agentro-evolution --tail 50",
            ],
            "degraded": [
                "Verificar que la API Key sea correcta en Admin > API Keys",
                "Revisar logs: docker logs agentro-evolution --tail 50",
                "Verificar conectividad de red del container",
            ],
        },
        "OpenAI": {
            "error": [
                "Configurar OpenAI API Key en Admin > API Keys",
                "Verificar saldo en platform.openai.com/usage",
                "Generar nueva key en platform.openai.com/api-keys",
            ],
            "degraded": [
                "Verificar límites de rate en platform.openai.com",
                "Verificar que la API Key no esté expirada",
                "Revisar saldo en platform.openai.com/usage",
            ],
        },
    }

    return actions_map.get(service, {}).get(status, [
        f"Revisar la configuración del servicio {service}",
        "Contactar soporte si el problema persiste",
    ])


@router.get("/health", response_model=HealthResponse)
async def admin_system_health(
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Estado de salud de todos los servicios de la plataforma + recursos VPS."""
    import time
    services: list[ServiceHealth] = []

    # 1. PostgreSQL
    try:
        t0 = time.time()
        db.execute(text("SELECT 1"))
        latency = round((time.time() - t0) * 1000, 1)
        status = "ok"
        details = "Conexión activa"
        services.append(ServiceHealth(name="PostgreSQL", status=status, latency_ms=latency, details=details, actions=_recommend_actions("PostgreSQL", status, details)))
    except Exception as e:
        details = str(e)[:200]
        services.append(ServiceHealth(name="PostgreSQL", status="error", latency_ms=None, details=details, actions=_recommend_actions("PostgreSQL", "error", details)))

    # 2. Redis
    try:
        settings = get_settings()
        t0 = time.time()
        r = redis.Redis.from_url(settings.redis_url, socket_timeout=3)
        r.ping()
        latency = round((time.time() - t0) * 1000, 1)
        r.close()
        status = "ok"
        details = "Conexión activa"
        services.append(ServiceHealth(name="Redis", status=status, latency_ms=latency, details=details, actions=_recommend_actions("Redis", status, details)))
    except Exception as e:
        details = str(e)[:200]
        services.append(ServiceHealth(name="Redis", status="error", latency_ms=None, details=details, actions=_recommend_actions("Redis", "error", details)))

    # 3. Evolution API (WhatsApp)
    try:
        evo_url = get_dynamic_setting("evolution_api_url")
        evo_key = get_dynamic_setting("evolution_api_key")
        if not evo_url or not evo_key:
            status = "error"
            details = "URL o API Key no configurada"
            services.append(ServiceHealth(name="Evolution API", status=status, latency_ms=None, details=details, actions=_recommend_actions("Evolution API", status, details)))
        else:
            import httpx
            t0 = time.time()
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{evo_url}/instance/fetchInstances", headers={"apikey": evo_key})
            latency = round((time.time() - t0) * 1000, 1)
            if resp.status_code == 200:
                status = "ok"
                details = f"HTTP {resp.status_code}"
            else:
                status = "degraded"
                details = f"HTTP {resp.status_code}"
            services.append(ServiceHealth(name="Evolution API", status=status, latency_ms=latency, details=details, actions=_recommend_actions("Evolution API", status, details)))
    except Exception as e:
        details = str(e)[:200]
        services.append(ServiceHealth(name="Evolution API", status="error", latency_ms=None, details=details, actions=_recommend_actions("Evolution API", "error", details)))

    # 4. OpenAI
    try:
        openai_key = get_dynamic_setting("openai_api_key")
        if not openai_key:
            status = "error"
            details = "API Key no configurada"
            services.append(ServiceHealth(name="OpenAI", status=status, latency_ms=None, details=details, actions=_recommend_actions("OpenAI", status, details)))
        else:
            import httpx
            t0 = time.time()
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {openai_key}"})
            latency = round((time.time() - t0) * 1000, 1)
            if resp.status_code == 200:
                status = "ok"
                details = "API accesible"
            else:
                status = "degraded"
                details = f"HTTP {resp.status_code}"
            services.append(ServiceHealth(name="OpenAI", status=status, latency_ms=latency, details=details, actions=_recommend_actions("OpenAI", status, details)))
    except Exception as e:
        details = str(e)[:200]
        services.append(ServiceHealth(name="OpenAI", status="error", latency_ms=None, details=details, actions=_recommend_actions("OpenAI", "error", details)))

    # Overall
    statuses = [s.status for s in services]
    if all(s == "ok" for s in statuses):
        overall = "ok"
    elif any(s == "error" for s in statuses):
        overall = "error"
    else:
        overall = "degraded"

    # VPS Resources
    vps = _get_vps_resources()

    return HealthResponse(overall=overall, services=services, vps=vps)


# ── AI Agents overview ───────────────────────────────────────────────────────

class AgentItemResponse(BaseModel):
    id: str
    name: str
    description: str | None
    agent_type: str
    is_active: bool
    enabled_tools: list[str] | None
    system_prompt: str | None
    config: dict
    created_at: str


class StoreAgentSummary(BaseModel):
    store_id: str
    store_name: str
    store_slug: str
    agents: list[AgentItemResponse]


@router.get("/ai-agents", response_model=list[StoreAgentSummary])
def admin_ai_agents(
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Lista todos los agentes IA agrupados por tienda."""
    import json as _json

    stores = db.query(Store).filter(Store.is_active == True).order_by(Store.name).all()
    result = []

    for store in stores:
        agents = db.query(AIAgent).filter(
            AIAgent.store_id == store.id,
        ).order_by(AIAgent.created_at.desc()).all()

        agent_items = []
        for a in agents:
            try:
                tools = _json.loads(a.enabled_tools) if a.enabled_tools else None
            except Exception:
                tools = None
            try:
                cfg = _json.loads(a.config) if a.config else {}
            except Exception:
                cfg = {}

            agent_items.append(AgentItemResponse(
                id=a.id,
                name=a.name,
                description=a.description,
                agent_type=a.agent_type or "generic",
                is_active=a.is_active,
                enabled_tools=tools,
                system_prompt=a.system_prompt or None,
                config=cfg,
                created_at=str(a.created_at) if a.created_at else "",
            ))

        result.append(StoreAgentSummary(
            store_id=store.id,
            store_name=store.name,
            store_slug=store.slug,
            agents=agent_items,
        ))

    return result
