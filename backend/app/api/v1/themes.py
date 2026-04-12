"""
Endpoints de temas/plantillas.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store, StoreTheme
from app.models.user import User
from app.services.theme_service import (
    get_presets,
    get_store_theme,
    get_theme_config,
    update_store_theme,
    apply_preset,
    get_theme_versions,
    restore_theme_version,
    get_marketplace_templates,
    install_marketplace_template,
)
from app.services.audit_service import log_action, get_client_info
from app.schemas.theme import ThemeUpdate

router = APIRouter()


@router.get("/presets")
def list_theme_presets():
    """Lista de presets disponibles (streetwear, minimal, modern)."""
    return get_presets()


@router.get("/current")
def get_current_theme(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene el tema actual de la tienda (requiere X-Store-ID)."""
    theme = get_store_theme(db, store.id)
    if not theme:
        return {
            "template_name": "minimal",
            "custom_config": get_theme_config(None),
        }
    return {
        "id": theme.id,
        "template_name": theme.template_name,
        "custom_css": theme.custom_css,
        "custom_config": get_theme_config(theme),
    }


@router.patch("/current")
def patch_current_theme(
    data: ThemeUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza el tema de la tienda (requiere X-Store-ID)."""
    update_data = data.model_dump(exclude_unset=True)
    theme = update_store_theme(
        db, store.id,
        template_name=update_data.get("template_name"),
        custom_config=update_data.get("custom_config"),
    )

    ip, user_agent = get_client_info(request)
    log_action(
        db, "theme.changed", user_id=user.id, store_id=store.id,
        resource_type="theme", resource_id=theme.id,
        details={"template_name": theme.template_name},
        ip_address=ip, user_agent=user_agent,
    )

    return {
        "id": theme.id,
        "template_name": theme.template_name,
        "custom_config": get_theme_config(theme),
    }


@router.post("/current/apply-preset/{preset_id}")
def apply_theme_preset(
    preset_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Aplica un preset a la tienda (requiere X-Store-ID)."""
    try:
        theme = apply_preset(db, store.id, preset_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ip, user_agent = get_client_info(request)
    log_action(
        db, "theme.changed", user_id=user.id, store_id=store.id,
        resource_type="theme", resource_id=theme.id,
        details={"template_name": theme.template_name, "preset_id": preset_id},
        ip_address=ip, user_agent=user_agent,
    )

    return {
        "id": theme.id,
        "template_name": theme.template_name,
        "custom_config": get_theme_config(theme),
    }


@router.get("/versions")
def list_theme_versions(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista el historial de versiones del tema."""
    versions = get_theme_versions(db, store.id)
    return [
        {
            "id": v.id,
            "version": v.version,
            "template_name": v.template_name,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


@router.post("/versions/{version_id}/restore")
def restore_version(
    version_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Restaura una versión anterior del tema."""
    try:
        theme = restore_theme_version(db, store.id, version_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    ip, user_agent = get_client_info(request)
    log_action(
        db, "theme.restored", user_id=user.id, store_id=store.id,
        resource_type="theme", resource_id=theme.id,
        details={"restored_version_id": version_id},
        ip_address=ip, user_agent=user_agent,
    )

    return {
        "id": theme.id,
        "template_name": theme.template_name,
        "custom_config": get_theme_config(theme),
    }


@router.get("/marketplace")
def list_marketplace_templates(
    db: Session = Depends(get_db),
):
    """Lista plantillas disponibles en el marketplace (público)."""
    templates = get_marketplace_templates(db)
    return [
        {
            "id": t.id,
            "name": t.name,
            "author": t.author,
            "description": t.description,
            "preview_image": t.preview_image,
            "downloads": t.downloads,
            "is_featured": t.is_featured,
        }
        for t in templates
    ]


@router.post("/marketplace/{template_id}/install")
def install_template(
    template_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Instala una plantilla del marketplace en la tienda."""
    try:
        theme = install_marketplace_template(db, store.id, template_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    ip, user_agent = get_client_info(request)
    log_action(
        db, "theme.marketplace_install", user_id=user.id, store_id=store.id,
        resource_type="theme", resource_id=theme.id,
        details={"marketplace_template_id": template_id},
        ip_address=ip, user_agent=user_agent,
    )

    return {
        "id": theme.id,
        "template_name": theme.template_name,
        "custom_config": get_theme_config(theme),
    }
