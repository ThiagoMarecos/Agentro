"""
Exception handlers globales para respuestas consistentes.
"""

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.utils.exceptions import NexoraException


async def nexora_exception_handler(request: Request, exc: NexoraException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "code": exc.__class__.__name__,
            "errors": exc.details,
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": "HTTPException",
            "errors": {},
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = {}
    for err in exc.errors():
        loc = ".".join(str(x) for x in err["loc"] if x != "body")
        if loc not in errors:
            errors[loc] = []
        errors[loc].append(err["msg"])
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Error de validación",
            "code": "ValidationError",
            "errors": errors,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import logging
    import traceback
    logger = logging.getLogger("app.exceptions")
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}: "
        f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Error interno del servidor: {type(exc).__name__}: {str(exc)[:300]}",
            "code": "InternalServerError",
            "errors": {},
        },
    )
