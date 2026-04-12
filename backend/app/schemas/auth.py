"""
Schemas de autenticación.
"""

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
