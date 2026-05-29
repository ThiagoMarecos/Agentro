"""
Schemas de autenticación.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    # 6 chars mínimo (UX), 72 bytes máximo (límite de bcrypt).
    # Pydantic valida en CHARACTERS, no en bytes — pero 64 chars deja
    # margen seguro para caracteres multibyte (emoji, acentos, etc.)
    password: str = Field(..., min_length=6, max_length=64)
    full_name: str | None = Field(None, max_length=200)

    @field_validator("password")
    @classmethod
    def password_bytes_within_limit(cls, v: str) -> str:
        # Doble check: si por algún motivo entró con muchos bytes multibyte,
        # devolvemos error claro en lugar de explotar más adelante.
        if len(v.encode("utf-8")) > 72:
            raise ValueError("La contraseña es demasiado larga. Usá menos caracteres o evitá emojis.")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    avatar_url: str | None = None
    is_verified: bool = False
    is_superadmin: bool = False

    class Config:
        from_attributes = True


class MembershipInfo(BaseModel):
    store_id: str
    store_name: str
    store_slug: str
    role: str


class CurrentStoreInfo(BaseModel):
    id: str
    name: str
    slug: str


class AuthMeResponse(BaseModel):
    user: UserResponse
    memberships: list[MembershipInfo]
    current_store: CurrentStoreInfo | None
    must_onboard: bool
    suggested_redirect: str
