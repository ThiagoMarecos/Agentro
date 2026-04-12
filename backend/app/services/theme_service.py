"""
Servicio de temas/plantillas de tienda.
"""

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.store import Store, StoreTheme, ThemeVersion, TemplateMarketplace

DEFAULT_THEME_CONFIG = {
    "colors": {
        "primary": "#6366F1",
        "secondary": "#8B5CF6",
        "accent": "#22C55E",
        "background": "#0F172A",
        "text": "#F8FAFC",
    },
    "typography": {"font_family": "Outfit", "heading_scale": "normal"},
    "button_style": "rounded",
    "card_style": "elevated",
    "hero_style": "centered",
    "layout_density": "comfortable",
    "grid_cols": 4,
    "custom_banner": "",
    "section_toggles": {"hero": True, "featured": True},
    "sections": [
        {"id": "default-hero", "type": "hero", "enabled": True, "order": 0, "config": {"style": "centered", "title": "", "subtitle": "", "cta_text": "Ver catálogo", "bg_image": ""}},
        {"id": "default-products", "type": "featured_products", "enabled": True, "order": 1, "config": {"columns": 4, "count": 8, "show_price": True}},
        {"id": "default-categories", "type": "categories", "enabled": False, "order": 2, "config": {"layout": "grid"}},
        {"id": "default-drops", "type": "drops", "enabled": True, "order": 3, "config": {}},
        {"id": "default-testimonials", "type": "testimonials", "enabled": False, "order": 4, "config": {"items": []}},
        {"id": "default-newsletter", "type": "newsletter", "enabled": False, "order": 5, "config": {"title": "", "description": ""}},
        {"id": "default-custom-text", "type": "custom_text", "enabled": False, "order": 6, "config": {"title": "", "body": "", "image": ""}},
    ],
}

THEME_PRESETS = [
    {
        "id": "streetwear",
        "name": "Streetwear",
        "description": "Estética urbana y bold",
        "default_tokens": {
            "colors": {
                "primary": "#6366F1",
                "secondary": "#8B5CF6",
                "accent": "#22C55E",
                "background": "#0F172A",
                "text": "#F8FAFC",
            },
            "typography": {"font_family": "Space Grotesk", "heading_scale": "bold"},
            "button_style": "rounded",
            "card_style": "elevated",
            "hero_style": "fullwidth",
            "layout_density": "comfortable",
            "grid_cols": 2,
        },
    },
    {
        "id": "boutique",
        "name": "Boutique",
        "description": "Cálido y sofisticado",
        "default_tokens": {
            "colors": {
                "primary": "#E11D48",
                "secondary": "#78716C",
                "accent": "#F59E0B",
                "background": "#FDF8F4",
                "text": "#1C1917",
            },
            "typography": {"font_family": "DM Sans", "heading_scale": "normal"},
            "button_style": "pill",
            "card_style": "outlined",
            "hero_style": "split",
            "layout_density": "comfortable",
            "grid_cols": 3,
        },
    },
    {
        "id": "tech",
        "name": "Tech",
        "description": "Tecnológico y premium",
        "default_tokens": {
            "colors": {
                "primary": "#06B6D4",
                "secondary": "#3B82F6",
                "accent": "#A855F7",
                "background": "#020617",
                "text": "#F8FAFC",
            },
            "typography": {"font_family": "Plus Jakarta Sans", "heading_scale": "normal"},
            "button_style": "rounded",
            "card_style": "elevated",
            "hero_style": "gradient",
            "layout_density": "comfortable",
            "grid_cols": 3,
        },
    },
    {
        "id": "artesanal",
        "name": "Artesanal",
        "description": "Natural y artesanal",
        "default_tokens": {
            "colors": {
                "primary": "#92400E",
                "secondary": "#65A30D",
                "accent": "#D97706",
                "background": "#FFFBEB",
                "text": "#1C1917",
            },
            "typography": {"font_family": "Playfair Display", "heading_scale": "normal"},
            "button_style": "rounded",
            "card_style": "outlined",
            "hero_style": "centered",
            "layout_density": "spacious",
            "grid_cols": 3,
        },
    },
]


def get_presets() -> list[dict[str, Any]]:
    """Lista de presets disponibles."""
    return THEME_PRESETS


def get_store_theme(db: Session, store_id: str) -> StoreTheme | None:
    """Obtiene el tema de la tienda."""
    theme = db.query(StoreTheme).filter(StoreTheme.store_id == store_id).first()
    return theme


def get_theme_config(theme: StoreTheme) -> dict[str, Any]:
    """Parsea custom_config del tema."""
    if not theme or not theme.custom_config:
        return DEFAULT_THEME_CONFIG.copy()
    try:
        config = json.loads(theme.custom_config) if isinstance(theme.custom_config, str) else theme.custom_config
        return {**DEFAULT_THEME_CONFIG, **config}
    except (json.JSONDecodeError, TypeError):
        return DEFAULT_THEME_CONFIG.copy()


def get_preset_tokens(preset_id: str) -> dict[str, Any] | None:
    """Obtiene los tokens por defecto de un preset."""
    for p in THEME_PRESETS:
        if p["id"] == preset_id:
            return p.get("default_tokens")
    return None


def update_store_theme(
    db: Session,
    store_id: str,
    template_name: str | None = None,
    custom_config: dict[str, Any] | None = None,
) -> StoreTheme:
    """Actualiza el tema de la tienda."""
    theme = db.query(StoreTheme).filter(StoreTheme.store_id == store_id).first()
    store = db.query(Store).filter(Store.id == store_id).first()

    if not theme:
        theme = StoreTheme(
            store_id=store_id,
            template_name=template_name or "streetwear",
            custom_config=json.dumps(custom_config or DEFAULT_THEME_CONFIG),
        )
        db.add(theme)
    else:
        save_theme_version(db, store_id, theme)
        if template_name is not None:
            theme.template_name = template_name
            if store:
                store.template_id = template_name
        if custom_config is not None:
            theme.custom_config = json.dumps(custom_config)

    db.commit()
    db.refresh(theme)
    return theme


def apply_preset(db: Session, store_id: str, preset_id: str) -> StoreTheme:
    """Aplica un preset a la tienda."""
    tokens = get_preset_tokens(preset_id)
    if not tokens:
        raise ValueError(f"Preset '{preset_id}' no encontrado")

    return update_store_theme(
        db,
        store_id,
        template_name=preset_id,
        custom_config=tokens,
    )


def save_theme_version(db: Session, store_id: str, theme: StoreTheme) -> ThemeVersion:
    """Guarda un snapshot de la versión actual del tema."""
    import uuid

    last_version = db.query(ThemeVersion).filter(
        ThemeVersion.store_id == store_id
    ).order_by(ThemeVersion.version.desc()).first()

    next_version = (last_version.version + 1) if last_version else 1

    version = ThemeVersion(
        id=str(uuid.uuid4()),
        store_id=store_id,
        version=next_version,
        custom_config=theme.custom_config,
        template_name=theme.template_name,
    )
    db.add(version)

    old_versions = db.query(ThemeVersion).filter(
        ThemeVersion.store_id == store_id
    ).order_by(ThemeVersion.version.desc()).offset(20).all()
    for v in old_versions:
        db.delete(v)

    db.commit()
    db.refresh(version)
    return version


def get_theme_versions(db: Session, store_id: str) -> list[ThemeVersion]:
    """Obtiene el historial de versiones del tema."""
    return db.query(ThemeVersion).filter(
        ThemeVersion.store_id == store_id
    ).order_by(ThemeVersion.version.desc()).limit(20).all()


def restore_theme_version(db: Session, store_id: str, version_id: str) -> StoreTheme:
    """Restaura una versión anterior del tema."""
    version = db.query(ThemeVersion).filter(
        ThemeVersion.id == version_id,
        ThemeVersion.store_id == store_id
    ).first()
    if not version:
        raise ValueError("Versión no encontrada")

    return update_store_theme(
        db, store_id,
        template_name=version.template_name,
        custom_config=json.loads(version.custom_config) if version.custom_config else None,
    )


def get_marketplace_templates(db: Session) -> list[TemplateMarketplace]:
    """Lista plantillas activas del marketplace."""
    return db.query(TemplateMarketplace).filter(
        TemplateMarketplace.is_active == True
    ).order_by(TemplateMarketplace.downloads.desc()).all()


def install_marketplace_template(db: Session, store_id: str, template_id: str) -> StoreTheme:
    """Instala una plantilla del marketplace en la tienda."""
    template = db.query(TemplateMarketplace).filter(
        TemplateMarketplace.id == template_id,
        TemplateMarketplace.is_active == True
    ).first()
    if not template:
        raise ValueError("Plantilla no encontrada")

    config = json.loads(template.config) if template.config else None

    template.downloads = (template.downloads or 0) + 1
    db.commit()

    return update_store_theme(
        db, store_id,
        template_name=template.name,
        custom_config=config,
    )
