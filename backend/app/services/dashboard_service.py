"""
Servicio de dashboard admin.
Métricas, actividad reciente y setup progress.
"""

import json
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, and_, cast, Date
from sqlalchemy.orm import Session

from app.models.store import Store, StoreTheme
from app.models.product import Product, ProductVariant, Category
from app.models.order import Order
from app.models.audit import AuditLog
from app.models.ai import Conversation, AIAgent, AIChannel

LOW_STOCK_THRESHOLD = 5


def _get_revenue_stats(db: Session, store_id: str) -> dict[str, Any]:
    """Calcula métricas de revenue por períodos."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    excluded_statuses = ["cancelled"]

    def revenue_in_range(start, end=None):
        q = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
            Order.store_id == store_id,
            Order.created_at >= start,
            ~Order.status.in_(excluded_statuses),
        )
        if end:
            q = q.filter(Order.created_at < end)
        return float(q.scalar() or 0)

    def count_in_range(start, end=None):
        q = db.query(func.count(Order.id)).filter(
            Order.store_id == store_id,
            Order.created_at >= start,
            ~Order.status.in_(excluded_statuses),
        )
        if end:
            q = q.filter(Order.created_at < end)
        return int(q.scalar() or 0)

    revenue_today = revenue_in_range(today_start)
    revenue_week = revenue_in_range(week_start)
    revenue_month = revenue_in_range(month_start)
    revenue_prev_month = revenue_in_range(prev_month_start, month_start)
    revenue_all_time = float(
        db.query(func.coalesce(func.sum(Order.total), 0)).filter(
            Order.store_id == store_id,
            ~Order.status.in_(excluded_statuses),
        ).scalar() or 0
    )

    orders_today = count_in_range(today_start)
    orders_week = count_in_range(week_start)
    orders_month = count_in_range(month_start)

    total_orders = int(
        db.query(func.count(Order.id)).filter(Order.store_id == store_id).scalar() or 0
    )
    pending_orders = int(
        db.query(func.count(Order.id)).filter(
            Order.store_id == store_id, Order.status == "pending"
        ).scalar() or 0
    )

    valid_orders_count = int(
        db.query(func.count(Order.id)).filter(
            Order.store_id == store_id,
            ~Order.status.in_(excluded_statuses),
        ).scalar() or 0
    )
    avg_order_value = round(revenue_all_time / valid_orders_count, 2) if valid_orders_count > 0 else 0

    month_change = None
    if revenue_prev_month > 0:
        month_change = round(((revenue_month - revenue_prev_month) / revenue_prev_month) * 100, 1)

    # Revenue diaria de los últimos 7 días
    daily_revenue = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_rev = revenue_in_range(day_start, day_end)
        daily_revenue.append({
            "date": day_start.strftime("%a"),
            "revenue": day_rev,
        })

    return {
        "revenue_today": revenue_today,
        "revenue_week": revenue_week,
        "revenue_month": revenue_month,
        "revenue_prev_month": revenue_prev_month,
        "revenue_all_time": revenue_all_time,
        "month_change_pct": month_change,
        "orders_today": orders_today,
        "orders_week": orders_week,
        "orders_month": orders_month,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "avg_order_value": avg_order_value,
        "daily_revenue": daily_revenue,
    }


def get_dashboard_summary(db: Session, store_id: str) -> dict[str, Any]:
    """Resumen del dashboard para la tienda."""
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        return {}

    # Product counts by status
    product_counts = (
        db.query(Product.status, func.count(Product.id))
        .filter(Product.store_id == store_id)
        .group_by(Product.status)
        .all()
    )
    status_map = {row[0]: row[1] for row in product_counts}
    total_products = sum(status_map.values())
    active_products = status_map.get("active", 0)
    draft_products = status_map.get("draft", 0)
    archived_products = status_map.get("archived", 0)

    # Categories
    total_categories = db.query(func.count(Category.id)).filter(
        Category.store_id == store_id,
        Category.is_active == True,
    ).scalar() or 0

    # Low stock
    low_stock_count = 0
    products = db.query(Product).filter(Product.store_id == store_id).all()
    for p in products:
        if p.has_variants and p.variants:
            for v in p.variants:
                if v.track_inventory and v.stock_quantity < LOW_STOCK_THRESHOLD:
                    low_stock_count += 1
        else:
            if p.track_inventory and p.stock_quantity < LOW_STOCK_THRESHOLD:
                low_stock_count += 1

    # Conversations
    conversations_count = db.query(func.count(Conversation.id)).filter(
        Conversation.store_id == store_id,
    ).scalar() or 0

    # AI agents
    ai_agents_count = db.query(func.count(AIAgent.id)).filter(
        AIAgent.store_id == store_id,
        AIAgent.is_active == True,
    ).scalar() or 0

    # Revenue & order stats
    revenue_stats = _get_revenue_stats(db, store_id)

    # Setup progress
    setup_progress = get_setup_progress(db, store)

    return {
        "total_products": total_products,
        "active_products": active_products,
        "draft_products": draft_products,
        "archived_products": archived_products,
        "total_categories": total_categories,
        "low_stock_count": low_stock_count,
        "conversations_count": conversations_count,
        "ai_agents_count": ai_agents_count,
        "store_created_at": store.created_at.isoformat() if store.created_at else None,
        "setup_progress": setup_progress,
        **revenue_stats,
    }


def get_recent_activity(db: Session, store_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Actividad reciente de la tienda desde AuditLog."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.store_id == store_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    from app.models.user import User

    result = []
    for log in logs:
        user_email = None
        if log.user_id:
            user = db.query(User).filter(User.id == log.user_id).first()
            if user:
                user_email = user.email

        details = None
        if log.details:
            try:
                details = json.loads(log.details) if isinstance(log.details, str) else log.details
            except (json.JSONDecodeError, TypeError):
                pass

        result.append({
            "id": log.id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_email": user_email,
        })

    return result


def get_setup_progress(db: Session, store: Store) -> dict[str, Any]:
    """Progreso de configuración de la tienda."""
    theme = db.query(StoreTheme).filter(StoreTheme.store_id == store.id).first()
    if not theme:
        theme = None

    has_categories = (
        db.query(func.count(Category.id)).filter(
            Category.store_id == store.id,
            Category.is_active == True,
        ).scalar() or 0
    ) > 0

    has_products = (
        db.query(func.count(Product.id)).filter(Product.store_id == store.id).scalar() or 0
    ) > 0

    ai_channel_configured = (
        db.query(func.count(AIChannel.id)).filter(
            AIChannel.store_id == store.id,
            AIChannel.is_active == True,
        ).scalar() or 0
    ) > 0

    store_profile_completed = bool(
        store.name and store.name.strip()
        and store.slug and store.slug.strip()
        and (store.description or store.name)
    )

    logo_set = bool(store.logo_url and store.logo_url.strip())
    theme_selected = bool(theme and theme.template_name and theme.template_name.strip())

    storefront_ready = store_profile_completed and theme_selected and has_products

    checks = [
        {"id": "store_profile_completed", "label": "Store profile completed", "completed": store_profile_completed},
        {"id": "logo_set", "label": "Logo set", "completed": logo_set},
        {"id": "theme_selected", "label": "Theme selected", "completed": theme_selected},
        {"id": "has_categories", "label": "At least 1 category", "completed": has_categories},
        {"id": "has_products", "label": "At least 1 product", "completed": has_products},
        {"id": "ai_channel_configured", "label": "AI channel configured", "completed": ai_channel_configured},
        {"id": "storefront_ready", "label": "Storefront ready", "completed": storefront_ready},
    ]

    completed = sum(1 for c in checks if c["completed"])
    total = len(checks)

    return {
        "checks": checks,
        "completed": completed,
        "total": total,
    }
