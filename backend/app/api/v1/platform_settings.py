"""
Endpoints para gestión de configuración global de la plataforma.
Solo accesible por superadmin.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.core.dependencies import require_superadmin
from app.services.platform_settings_service import (
    get_all_settings,
    bulk_update_settings,
)

router = APIRouter()


class SettingItem(BaseModel):
    id: str
    key: str
    label: str
    category: str
    is_secret: bool
    has_value: bool
    display_value: str
    real_value: str


class BulkUpdateRequest(BaseModel):
    settings: dict[str, str]  # { "google_client_id": "valor", ... }


@router.get("", response_model=list[SettingItem])
def list_platform_settings(
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Lista todas las configuraciones de la plataforma (valores secretos ofuscados)."""
    return get_all_settings(db)


@router.patch("")
def update_platform_settings(
    body: BulkUpdateRequest,
    admin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """Actualiza configuraciones de la plataforma. Solo enviar las que cambiaron."""
    count = bulk_update_settings(db, body.settings)
    return {"ok": True, "updated": count, "message": f"{count} configuracion(es) actualizada(s). Reinicia el backend para aplicar cambios."}
