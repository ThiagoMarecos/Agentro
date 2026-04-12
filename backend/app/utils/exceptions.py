"""
Excepciones personalizadas para Nexora.
Base para manejo consistente de errores en la API.
"""

from typing import Any, Optional


class NexoraException(Exception):
    """Excepción base de Nexora."""

    def __init__(
        self,
        message: str = "Error interno",
        status_code: int = 500,
        details: Optional[dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(NexoraException):
    """Recurso no encontrado."""

    def __init__(self, message: str = "Recurso no encontrado", details: Optional[dict] = None):
        super().__init__(message=message, status_code=404, details=details)


class UnauthorizedError(NexoraException):
    """No autenticado."""

    def __init__(self, message: str = "No autenticado", details: Optional[dict] = None):
        super().__init__(message=message, status_code=401, details=details)


class ForbiddenError(NexoraException):
    """Sin permisos."""

    def __init__(self, message: str = "Sin permisos para esta acción", details: Optional[dict] = None):
        super().__init__(message=message, status_code=403, details=details)


class ValidationError(NexoraException):
    """Error de validación."""

    def __init__(self, message: str = "Error de validación", details: Optional[dict] = None):
        super().__init__(message=message, status_code=422, details=details)


class TenantAccessError(ForbiddenError):
    """Acceso denegado por aislamiento multi-tenant."""

    def __init__(self, message: str = "Acceso denegado a este recurso de la tienda"):
        super().__init__(message=message)
