"""
Middleware de rate limiting.
Estructura base: en desarrollo usa in-memory; en producción usar Redis.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from collections import defaultdict
from time import time

# In-memory para desarrollo (no escalable)
_request_counts: dict[str, list[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limit simple por IP.
    En producción, usar Redis con el mismo patrón.
    """

    def __init__(self, app, requests_per_window: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        now = time()
        key = ip

        # Limpiar timestamps fuera de la ventana
        _request_counts[key] = [
            t for t in _request_counts[key]
            if now - t < self.window_seconds
        ]

        if len(_request_counts[key]) >= self.requests_per_window:
            return JSONResponse(
                status_code=429,
                content={"detail": "Demasiadas peticiones", "code": "RateLimitExceeded"},
            )

        _request_counts[key].append(now)
        response = await call_next(request)
        return response
