"""
Endpoints de settings.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User
from app.models.settings import Setting
from app.schemas.settings import SettingUpdate, SettingResponse
from app.services.audit_service import log_action, get_client_info

router = APIRouter()


@router.get("", response_model=dict[str, str])
def get_store_settings(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene settings de la tienda como key-value."""
    settings = db.query(Setting).filter(Setting.store_id == store.id).all()
    return {s.key: s.value or "" for s in settings}


@router.patch("")
def update_settings(
    data: SettingUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza un setting de la tienda."""
    setting = db.query(Setting).filter(
        Setting.store_id == store.id,
        Setting.key == data.key,
    ).first()
    if setting:
        setting.value = data.value
    else:
        setting = Setting(store_id=store.id, key=data.key, value=data.value)
        db.add(setting)
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "settings.update", user_id=user.id, store_id=store.id,
        resource_type="setting", resource_id=data.key,
        details={"key": data.key},
        ip_address=ip, user_agent=user_agent,
    )

    return {"success": True, "key": data.key, "value": data.value}
