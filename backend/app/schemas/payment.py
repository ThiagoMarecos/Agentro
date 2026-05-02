"""
Schemas Pydantic para métodos de pago, POS y caja registradora.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Provider catalog ──────────────────────────────────────────────

class ProviderConfigField(BaseModel):
    key: str
    label: str
    type: str  # text | secret
    required: bool = False


class ProviderInfo(BaseModel):
    """Provider del catálogo estático (sin store_id, es config global)."""
    key: str
    name: str
    countries: list[str]
    kind: Literal["cash", "manual_external", "manual_transfer", "digital_redirect"]
    config_fields: list[ProviderConfigField]
    icon: str
    description: str


class RecommendationResponse(BaseModel):
    country_code: str | None
    recommended_keys: list[str]
    providers: list[ProviderInfo]


# ── PaymentMethod (instancia configurada por tienda) ──────────────

class PaymentMethodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    store_id: str
    provider: str
    display_name: str | None = None
    is_active: bool
    sort_order: int
    config: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class CreatePaymentMethodRequest(BaseModel):
    provider: str  # debe ser una key del catálogo
    display_name: str | None = None
    is_active: bool = True
    sort_order: int = 0
    config: dict[str, Any] = Field(default_factory=dict)


class UpdatePaymentMethodRequest(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    config: dict[str, Any] | None = None


# ── Cash Register (caja por usuario) ──────────────────────────────

class OpenCashRegisterRequest(BaseModel):
    opening_cash: Decimal = Field(default=Decimal("0"), ge=0)


class CloseCashRegisterRequest(BaseModel):
    counted_cash: Decimal = Field(ge=0)
    notes: str | None = None


class CashRegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    store_id: str
    user_id: str
    opened_at: datetime
    opening_cash: Decimal
    closed_at: datetime | None = None
    expected_cash: Decimal | None = None
    counted_cash: Decimal | None = None
    cash_difference: Decimal | None = None
    sales_count: int
    sales_total: Decimal
    notes: str | None = None


# ── POS Sale (crear venta desde el POS) ───────────────────────────

class POSSaleItem(BaseModel):
    product_id: str
    variant_id: str | None = None
    quantity: int = Field(gt=0)
    # Si el cajero ajustó el precio (descuento manual), lo pasa acá.
    # Si es null, usamos el precio del producto.
    unit_price: Decimal | None = None


class POSSaleRequest(BaseModel):
    items: list[POSSaleItem]
    customer_id: str | None = None  # null = walk-in (sin registrar)
    payment_method_id: str | None = None  # null = sin método (raro, pero permitido)
    payment_received: Decimal | None = None  # efectivo: lo que entregó el cliente (calcula vuelto)
    payment_proof: str | None = None  # transferencia: comprobante (URL/texto)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    shipping_amount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None
    # Si la venta viene desde un chat escalado, lo trackeamos
    from_conversation_id: str | None = None


class POSSaleResponse(BaseModel):
    order_id: str
    order_number: str
    subtotal: Decimal
    discount: Decimal
    shipping: Decimal
    total: Decimal
    payment_status: str
    change_due: Decimal | None = None  # efectivo: vuelto a entregar
    payment_redirect_url: str | None = None  # MP/Stripe: link a checkout


# ── Refund ────────────────────────────────────────────────────────

class RefundRequest(BaseModel):
    amount: Decimal | None = None  # null = full refund
    reason: str | None = None


class RefundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    amount: Decimal
    reason: str | None = None
    is_full_refund: bool
    created_at: datetime
