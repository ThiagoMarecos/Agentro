"""
Nexora - Entrypoint principal de la API FastAPI.
"""

from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.api.router import api_router
from app.middlewares.tenant import TenantMiddleware
from app.middlewares.security_headers import SecurityHeadersMiddleware
from app.middlewares.rate_limit import RateLimitMiddleware
from app.utils.logging import setup_logging, get_logger
from app.utils.exceptions import NexoraException
from app.core.exceptions import (
    nexora_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ciclo de vida de la aplicación."""
    s = get_settings()
    if not s.google_client_id or not s.google_client_secret:
        logger.warning(
            "Google OAuth no configurado. Configure GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env "
            "para habilitar 'Iniciar con Google'."
        )
    logger.info("Iniciando Nexora API")
    yield
    logger.info("Cerrando Nexora API")


def create_app() -> FastAPI:
    """Factory para crear la aplicación FastAPI."""
    settings = get_settings()

    app = FastAPI(
        title="Nexora API",
        description="SaaS multi-tenant e-commerce con IA",
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan,
    )

    # Rate limiting (primero en la cadena para bloquear antes de cualquier procesamiento)
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_window=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window,
    )
    # Middleware de tenant
    app.add_middleware(TenantMiddleware)
    # Headers de seguridad
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS debe ser el último en agregarse para ser el más externo
    # y así agregar headers CORS incluso en respuestas de error
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    app.add_exception_handler(NexoraException, nexora_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # Router principal
    app.include_router(api_router, prefix=settings.api_prefix)

    # Archivos subidos (imágenes de productos)
    uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

    @app.get("/health")
    async def health_check():
        """Health check para load balancers y monitoreo."""
        return {"status": "ok", "service": "nexora-api"}

    return app


app = create_app()
