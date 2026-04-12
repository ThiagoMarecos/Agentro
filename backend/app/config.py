"""
Configuración centralizada de Nexora.
Carga variables de entorno y define settings por entorno.
"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

# Rutas a .env (raíz del proyecto y backend/)
_CONFIG_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CONFIG_DIR.parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_ENV_FILES = (
    str(_PROJECT_ROOT / ".env"),
    str(_BACKEND_DIR / ".env"),
    ".env",
)


class Settings(BaseSettings):
    """Configuración principal de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "Nexora"
    environment: str = "development"
    debug: bool = True

    # URLs (para OAuth redirects, emails, etc.)
    frontend_url: str = "http://localhost:5000"
    backend_url: str = "http://localhost:8000"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"

    # Base de datos (SQLite por defecto para desarrollo sin PostgreSQL)
    database_url: str = "sqlite:///./nexora.db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Seguridad
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""  # Default: {backend_url}/api/v1/auth/google/callback

    @property
    def resolved_google_redirect_uri(self) -> str:
        return self.google_redirect_uri or f"{self.backend_url.rstrip('/')}{self.api_prefix}/auth/google/callback"

    # OpenAI
    openai_api_key: str = ""
    openai_default_model: str = "gpt-4o"

    # Pexels (imágenes para IA prefill)
    pexels_api_key: str = ""

    # Evolution API (WhatsApp)
    evolution_api_url: str = ""
    evolution_api_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:5000,http://localhost:3000,http://localhost:8000,http://127.0.0.1:5000,http://127.0.0.1:3000,http://127.0.0.1:8000,http://192.168.100.192:5000,http://192.168.100.192:8000"

    # Rate limiting (estructura preparada)
    rate_limit_requests: int = 100
    rate_limit_window: int = 60

    @property
    def cors_origins_list(self) -> List[str]:
        """CORS origins como lista."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        """Indica si estamos en producción."""
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Obtiene la configuración (cacheada)."""
    return Settings()


def get_dynamic_setting(key: str) -> str:
    """
    Lee una setting primero de la DB (platform_settings) y luego del .env como fallback.
    Útil para API keys que el superadmin puede cambiar desde el panel sin reiniciar.
    """
    try:
        from app.db.session import SessionLocal
        from app.services.platform_settings_service import get_setting_value
        db = SessionLocal()
        try:
            val = get_setting_value(db, key)
            if val:
                return val
        finally:
            db.close()
    except Exception:
        pass
    # Fallback: leer del .env / settings
    return getattr(get_settings(), key, "") or ""
