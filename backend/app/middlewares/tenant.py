"""
Middleware de contexto multi-tenant.
Extrae store_id/tenant de headers o path y lo pone en request.state
para que los servicios puedan filtrar por tenant.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware base para contexto multi-tenant.
    En requests autenticados, el store_id se obtendrá del token o del path.
    Para rutas públicas (landing, storefront), el tenant puede venir del subdominio o path.
    """

    async def dispatch(self, request: Request, call_next):
        # Inicializar contexto de tenant
        request.state.tenant_id = None
        request.state.store_id = None

        store_id = request.headers.get("X-Store-ID") or request.query_params.get("store_id")
        if store_id:
            request.state.store_id = store_id
            request.state.tenant_id = store_id

        response = await call_next(request)
        return response
