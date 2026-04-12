"""
Schemas de categorías.
"""

import re

from pydantic import BaseModel, field_validator


def slug_validator(v: str) -> str:
    if len(v) < 3 or len(v) > 100:
        raise ValueError("Slug debe tener entre 3 y 100 caracteres")
    if not re.match(r"^[a-z0-9-]+$", v.lower()):
        raise ValueError("Slug solo permite letras minúsculas, números y guiones")
    return v.lower().strip()


class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    parent_id: str | None = None
    sort_order: int = 0
    is_active: bool = True

    _slug = field_validator("slug")(slug_validator)


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    parent_id: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None

    _slug = field_validator("slug")(lambda v: slug_validator(v) if v is not None else v)


class CategoryResponse(BaseModel):
    id: str
    store_id: str
    name: str
    slug: str
    description: str | None
    parent_id: str | None
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True
