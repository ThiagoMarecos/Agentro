"""
Schemas de pedidos.
"""

from datetime import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, EmailStr


class OrderItemResponse(BaseModel):
    id: str
    name: str
    sku: str | None
    quantity: int
    unit_price: Decimal
    total_price: Decimal

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: str
    store_id: str
    customer_id: str | None
    order_number: str
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    shipping_amount: Decimal
    discount_amount: Decimal
    total: Decimal
    currency: str
    created_at: dt | None = None

    class Config:
        from_attributes = True


class OrderDetailResponse(OrderResponse):
    items: list[OrderItemResponse] = []


class OrderCustomerInfo(BaseModel):
    email: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None

    class Config:
        from_attributes = True


class OrderAddressInfo(BaseModel):
    address_line1: str
    city: str
    state: str | None = None
    postal_code: str | None = None
    country: str = "AR"

    class Config:
        from_attributes = True


class OrderFullDetailResponse(OrderResponse):
    items: list[OrderItemResponse] = []
    customer: OrderCustomerInfo | None = None
    address: OrderAddressInfo | None = None
    notes: str | None = None


class OrderStatusUpdate(BaseModel):
    status: str


class StorefrontOrderItemCreate(BaseModel):
    product_id: str
    variant_id: str | None = None
    quantity: int = 1


class StorefrontOrderCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str = ""
    address: str
    city: str
    state: str = ""
    postal_code: str = ""
    notes: str = ""
    items: list[StorefrontOrderItemCreate]
