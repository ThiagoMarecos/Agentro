"""
Middleware de rate limiting por IP con ventanas deslizantes.
Usa in-memory para desarrollo. En producción con múltiples workers,
reemplazar _RequestCounter con una implementación Redis.
"""

from collections import defaultdict
from time import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

# Contadores en memoria: {ip: [timestamps]}
_request_counts: dict[str, list[float]] = defaultdict(list)

# Límites más estrictos para endpoints sensibles (requests por ventana)
_PATH_LIMITS: dict[str, tuple[int, int]] = {
    # (max_requests, window_seconds)
    "/api/v1/auth/login":      (10, 60),   # 10 intentos/min por IP
    "/api/v1/auth/register":   (5,  60),   # 5 registros/min por IP
    "/api/v1/auth/refresh":    (20, 60),
    "/api/v1/chat/message":    (20, 60),   # 20 mensajes/min por IP (cada uno = hasta 5 llamadas OpenAI)
    "/api/v1/whatsapp-webhook": (60, 60),
}

_SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limit global por IP con límites específicos por endpoint.
    Retorna 429 con cabecera Retry-After cuando se supera el límite.
    """

    def __init__(self, app, requests_per_window: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in _SKIP_PATHS:
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        now = time()

        # Determinar límite aplicable (específico o global)
        max_req, window = self._get_limit(path)
        key = f"{ip}:{path}:{window}"

        # Limpiar timestamps fuera de la ventana
        _request_counts[key] = [
            t for t in _request_counts[key]
            if now - t < window
        ]

        if len(_request_counts[key]) >= max_req:
            retry_after = int(window - (now - _request_counts[key][0])) + 1
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after)},
                content={
                    "detail": "Demasiadas peticiones. Intenta más tarde.",
                    "code": "RateLimitExceeded",
                    "retry_after": retry_after,
                },
            )

        _request_counts[key].append(now)
        return await call_next(request)

    def _get_limit(self, path: str) -> tuple[int, int]:
        """Retorna (max_requests, window_seconds) para el path dado."""
        for prefix, limits in _PATH_LIMITS.items():
            if path.startswith(prefix):
                return limits
        return self.requests_per_window, self.window_seconds
