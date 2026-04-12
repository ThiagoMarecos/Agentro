"""Health check endpoint."""

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()


@router.get("/health")
async def health():
    """Health check para la API."""
    return {"status": "ok", "version": "0.1.0"}


@router.get("/health/config")
async def health_config():
    """Diagnóstico de configuración (solo dev). Indica si OAuth está configurado sin revelar credenciales."""
    s = get_settings()
    return {
        "google_oauth_configured": bool(s.google_client_id and s.google_client_secret),
        "google_redirect_uri": s.resolved_google_redirect_uri,
    }
