"""Schemas Pydantic para InvitationRequest (formulario público de beta)."""

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


BusinessType = Literal["retail", "gastro", "services", "ecommerce", "other"]
ReferralSource = Literal[
    "google", "ai", "recommendation", "social", "ad", "press", "event", "other"
]


class InvitationRequestCreate(BaseModel):
    """Payload del POST público /api/v1/invitation-requests."""

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=200)
    business_name: str = Field(..., min_length=1, max_length=200)
    business_type: BusinessType
    whatsapp: Optional[str] = Field(None, max_length=50)
    country: Optional[str] = Field(None, max_length=50)
    referral_source: Optional[ReferralSource] = None
    referral_detail: Optional[str] = Field(None, max_length=500)
    expectations: Optional[str] = Field(None, max_length=2000)
    accepts_contact: bool = True

    @field_validator("full_name", "business_name")
    @classmethod
    def strip_and_collapse(cls, v: str) -> str:
        return " ".join((v or "").strip().split())

    @field_validator("whatsapp", "country", "referral_detail", "expectations")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s or None


class InvitationRequestPublicResponse(BaseModel):
    """Respuesta al solicitante después del POST. No exponemos status interno."""

    received: bool = True
    message: str = "Recibimos tu pedido. Te respondemos por mail en 24hs."
    request_id: str


# ── Admin (lectura / aprobación) ──

class InvitationRequestAdminItem(BaseModel):
    """Item de la lista admin."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    business_name: str
    business_type: str
    whatsapp: Optional[str] = None
    country: Optional[str] = None
    referral_source: Optional[str] = None
    referral_detail: Optional[str] = None
    expectations: Optional[str] = None
    accepts_contact: bool
    status: str
    notes: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None


class InvitationRequestUpdate(BaseModel):
    """Payload para que el admin actualice status / notes."""

    status: Optional[Literal["pending", "approved", "rejected", "contacted"]] = None
    notes: Optional[str] = None
