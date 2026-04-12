"""
Schemas comunes para respuestas consistentes.
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class BaseResponse(BaseModel):
    success: bool = True
    message: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int = 1
    page_size: int = 20


class ErrorResponse(BaseModel):
    detail: str
    code: str
    errors: dict[str, Any] = {}
