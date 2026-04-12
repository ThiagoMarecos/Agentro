"""
Schemas de Next Drop.
"""

from datetime import datetime
from pydantic import BaseModel


class NextDropItemCreate(BaseModel):
    name: str
    description: str | None = None
    drop_date: datetime | None = None
    image_url: str | None = None
    product_id: str | None = None
    is_active: bool = True
    sort_order: int = 0


class NextDropItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    drop_date: datetime | None = None
    image_url: str | None = None
    product_id: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class NextDropItemResponse(BaseModel):
    id: str
    store_id: str
    product_id: str | None
    name: str
    description: str | None
    drop_date: datetime | None
    image_url: str | None
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True
