"""
Schemas de onboarding.
"""

from pydantic import BaseModel, field_validator

from app.schemas.store import StoreResponse


class OnboardingStoreCreate(BaseModel):
    name: str
    slug: str
    industry: str | None = None
    country: str | None = None
    currency: str = "USD"
    language: str = "en"
    template_id: str | None = None

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        if len(v) < 3 or len(v) > 100:
            raise ValueError("Slug debe tener entre 3 y 100 caracteres")
        import re
        if not re.match(r"^[a-z0-9-]+$", v.lower()):
            raise ValueError("Slug solo permite letras minúsculas, números y guiones")
        return v.lower().strip()


class CurrentStoreSummary(BaseModel):
    id: str
    name: str
    slug: str


class OnboardingStatusResponse(BaseModel):
    authenticated: bool = True
    has_store: bool
    current_store: CurrentStoreSummary | None = None
    must_onboard: bool
    suggested_redirect: str


class CreateStoreResponse(BaseModel):
    store: StoreResponse
    membership: dict  # {store_id, user_id, role}
    theme: dict  # {store_id, template_name}
    next_redirect: str = "/app"
