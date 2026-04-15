"""
Servicio para gestionar configuraciones globales de la plataforma.
Encripta/desencripta valores sensibles con Fernet.
Permite que el backend lea API keys en runtime desde la DB.
"""

import base64
import hashlib
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.models.platform_settings import PlatformSetting
from app.config import get_settings

# ── Encriptación ────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    """Deriva una clave Fernet estable del SECRET_KEY de la app."""
    secret = get_settings().secret_key.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt_value(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


def mask_value(plain: str) -> str:
    """Muestra solo los últimos 4 caracteres."""
    if len(plain) <= 4:
        return "****"
    return "*" * (len(plain) - 4) + plain[-4:]


# ── CRUD ────────────────────────────────────────────────────────

# Definición de todas las keys que la plataforma necesita
PLATFORM_KEYS = [
    # Google OAuth
    {"key": "google_client_id", "label": "Google Client ID", "category": "google_oauth", "is_secret": True},
    {"key": "google_client_secret", "label": "Google Client Secret", "category": "google_oauth", "is_secret": True},
    {"key": "google_redirect_uri", "label": "Google Redirect URI", "category": "google_oauth", "is_secret": False},
    # OpenAI
    {"key": "openai_api_key", "label": "OpenAI API Key", "category": "openai", "is_secret": True},
    {"key": "openai_default_model", "label": "OpenAI Model", "category": "openai", "is_secret": False},
    # Evolution API (WhatsApp)
    {"key": "evolution_api_url", "label": "Evolution API URL", "category": "whatsapp", "is_secret": False},
    {"key": "evolution_api_key", "label": "Evolution API Key", "category": "whatsapp", "is_secret": True},
    # Pexels
    {"key": "pexels_api_key", "label": "Pexels API Key", "category": "pexels", "is_secret": True},
    # Stripe
    {"key": "stripe_publishable_key", "label": "Stripe Publishable Key", "category": "stripe", "is_secret": False},
    {"key": "stripe_secret_key", "label": "Stripe Secret Key", "category": "stripe", "is_secret": True},
    {"key": "stripe_webhook_secret", "label": "Stripe Webhook Secret", "category": "stripe", "is_secret": True},
    # Comisiones SaaS
    {"key": "saas_commission_percent", "label": "Comisión por venta (%)", "category": "billing", "is_secret": False},
    # VPS / SSH
    {"key": "vps_ssh_host", "label": "VPS IP / Host", "category": "vps", "is_secret": False},
    {"key": "vps_ssh_port", "label": "VPS SSH Port", "category": "vps", "is_secret": False},
    {"key": "vps_ssh_user", "label": "VPS SSH User", "category": "vps", "is_secret": False},
    {"key": "vps_ssh_password", "label": "VPS SSH Password", "category": "vps", "is_secret": True},
    # SECURITY: secret_key (JWT signing key) se gestiona SOLO por variable de entorno,
    # nunca por la DB ni por la API. Exponer su valor permitiría forjar tokens JWT.
]


def ensure_keys_exist(db: Session):
    """Crea las keys que no existan en la DB (sin valor)."""
    existing = {s.key for s in db.query(PlatformSetting.key).all()}
    for definition in PLATFORM_KEYS:
        if definition["key"] not in existing:
            setting = PlatformSetting(
                key=definition["key"],
                label=definition["label"],
                category=definition["category"],
                is_secret=definition["is_secret"],
                value=None,
            )
            db.add(setting)
    db.commit()


def get_all_settings(db: Session) -> list[dict]:
    """Retorna todas las settings para el frontend. Incluye valor real (solo para superadmin)."""
    ensure_keys_exist(db)
    settings = db.query(PlatformSetting).order_by(PlatformSetting.category, PlatformSetting.key).all()
    result = []
    for s in settings:
        plain_value = ""
        masked = ""
        has_value = False

        if s.value:
            has_value = True
            if s.is_secret:
                try:
                    plain_value = decrypt_value(s.value)
                    masked = mask_value(plain_value)
                except Exception:
                    plain_value = ""
                    masked = "****[error]"
            else:
                plain_value = s.value
                masked = s.value

        result.append({
            "id": s.id,
            "key": s.key,
            "label": s.label or s.key,
            "category": s.category or "general",
            "is_secret": s.is_secret,
            "has_value": has_value,
            "display_value": masked,
            "real_value": plain_value,
        })
    return result


def update_setting(db: Session, key: str, value: str) -> PlatformSetting:
    """Actualiza una setting. Encripta si es secreta."""
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if not setting:
        # Buscar definición
        definition = next((d for d in PLATFORM_KEYS if d["key"] == key), None)
        setting = PlatformSetting(
            key=key,
            label=definition["label"] if definition else key,
            category=definition["category"] if definition else "general",
            is_secret=definition["is_secret"] if definition else True,
        )
        db.add(setting)

    if setting.is_secret and value:
        setting.value = encrypt_value(value)
    else:
        setting.value = value if value else None

    db.commit()
    db.refresh(setting)
    return setting


def bulk_update_settings(db: Session, updates: dict[str, str]) -> int:
    """Actualiza múltiples settings de una vez."""
    count = 0
    for key, value in updates.items():
        if value is not None:  # Solo actualizar si se envió un valor
            update_setting(db, key, value)
            count += 1
    db.commit()
    return count


def get_setting_value(db: Session, key: str) -> str | None:
    """Lee el valor real (desencriptado) de una setting. Para uso interno del backend."""
    setting = db.query(PlatformSetting).filter(PlatformSetting.key == key).first()
    if not setting or not setting.value:
        return None
    if setting.is_secret:
        try:
            return decrypt_value(setting.value)
        except Exception:
            return None
    return setting.value


def get_runtime_config(db: Session) -> dict[str, str]:
    """Lee todas las settings como dict plano (desencriptadas). Para inyectar en runtime."""
    result = {}
    settings = db.query(PlatformSetting).filter(PlatformSetting.value.isnot(None)).all()
    for s in settings:
        if s.is_secret:
            try:
                result[s.key] = decrypt_value(s.value)
            except Exception:
                pass
        else:
            result[s.key] = s.value
    return result
