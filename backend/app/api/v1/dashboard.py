"""
Endpoints de dashboard admin.
"""

from fastapi import APIRouter, Depends, Query

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.services.dashboard_service import (
    get_dashboard_summary,
    get_recent_activity,
)

router = APIRouter()


@router.get("/summary")
def dashboard_summary(
    store: Store = Depends(get_current_store),
    db=Depends(get_db),
):
    """Resumen del dashboard: métricas, setup progress."""
    return get_dashboard_summary(db, store.id)


@router.get("/activity")
def dashboard_activity(
    store: Store = Depends(get_current_store),
    db=Depends(get_db),
    limit: int = Query(20, ge=1, le=50),
):
    """Actividad reciente de la tienda."""
    return get_recent_activity(db, store.id, limit=limit)
