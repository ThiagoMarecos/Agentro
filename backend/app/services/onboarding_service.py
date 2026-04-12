"""
Servicio de onboarding.
"""

from sqlalchemy.orm import Session

from app.models.store import StoreMember
from app.models.user import User
from app.repos.store_repo import get_user_stores
from app.schemas.auth import (
    UserResponse,
    MembershipInfo,
    CurrentStoreInfo,
    AuthMeResponse,
)
from app.schemas.store import StoreCreate
from app.services.store_service import create_store


def get_auth_state(db: Session, user: User) -> AuthMeResponse:
    """Construye respuesta enriquecida de estado de auth para /auth/me y onboarding."""
    memberships_data = []
    current_store = None

    for m in user.store_memberships:
        store = m.store
        if store:
            memberships_data.append(
                MembershipInfo(
                    store_id=store.id,
                    store_name=store.name,
                    store_slug=store.slug,
                    role=m.role,
                )
            )
            if current_store is None:
                current_store = CurrentStoreInfo(id=store.id, name=store.name, slug=store.slug)

    must_onboard = len(memberships_data) == 0
    if getattr(user, "is_superadmin", False):
        suggested_redirect = "/admin"
    elif must_onboard:
        suggested_redirect = "/onboarding"
    else:
        suggested_redirect = "/app"

    return AuthMeResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            avatar_url=user.avatar_url,
            is_verified=user.is_verified,
            is_superadmin=getattr(user, "is_superadmin", False),
        ),
        memberships=memberships_data,
        current_store=current_store,
        must_onboard=must_onboard,
        suggested_redirect=suggested_redirect,
    )


def get_onboarding_status(db: Session, user: User) -> dict:
    """Retorna estado de onboarding usando get_auth_state para consistencia."""
    auth_state = get_auth_state(db, user)
    current = auth_state.current_store
    return {
        "authenticated": True,
        "has_store": not auth_state.must_onboard,
        "current_store": (
            {"id": current.id, "name": current.name, "slug": current.slug} if current else None
        ),
        "must_onboard": auth_state.must_onboard,
        "suggested_redirect": auth_state.suggested_redirect,
    }


def create_initial_store(db: Session, user_id: str, data: StoreCreate) -> dict:
    """Crea la tienda inicial del usuario (onboarding)."""
    from fastapi import HTTPException

    stores = get_user_stores(db, user_id)
    if stores:
        raise HTTPException(
            status_code=400,
            detail="El usuario ya tiene una tienda. No puede crear otra desde onboarding.",
        )

    store = create_store(db, user_id, data)
    membership = next(
        (m for m in store.members if m.user_id == user_id),
        None,
    )
    theme = store.theme

    return {
        "store": store,
        "membership": (
            {"store_id": membership.store_id, "user_id": membership.user_id, "role": membership.role}
            if membership
            else {}
        ),
        "theme": (
            {"store_id": theme.store_id, "template_name": theme.template_name}
            if theme
            else {}
        ),
        "next_redirect": "/app",
    }
