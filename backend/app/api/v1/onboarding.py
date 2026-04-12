"""
Endpoints de onboarding.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.schemas.onboarding import (
    OnboardingStoreCreate,
    OnboardingStatusResponse,
    CreateStoreResponse,
    CurrentStoreSummary,
)
from app.schemas.store import StoreResponse, StoreCreate
from app.services.onboarding_service import get_onboarding_status, create_initial_store
from app.services.audit_service import log_action, get_client_info

router = APIRouter()


@router.get("/status", response_model=OnboardingStatusResponse)
def get_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estado de onboarding: si el usuario tiene tienda."""
    status = get_onboarding_status(db, user)
    current = status.get("current_store")
    return OnboardingStatusResponse(
        authenticated=True,
        has_store=status["has_store"],
        current_store=CurrentStoreSummary(**current) if current else None,
        must_onboard=status["must_onboard"],
        suggested_redirect=status["suggested_redirect"],
    )


@router.post("/store", response_model=CreateStoreResponse)
def create_store_endpoint(
    data: OnboardingStoreCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea tienda inicial (onboarding)."""
    store_data = StoreCreate(**data.model_dump())
    result = create_initial_store(db, user.id, store_data)

    ip, user_agent = get_client_info(request)
    store = result["store"]
    log_action(
        db, "store.create", user_id=user.id, store_id=store.id,
        resource_type="store", resource_id=store.id,
        details={"name": store.name, "slug": store.slug},
        ip_address=ip, user_agent=user_agent,
    )

    return CreateStoreResponse(
        store=StoreResponse(
            id=store.id, name=store.name, slug=store.slug, description=store.description,
            industry=store.industry, country=store.country, currency=store.currency,
            language=store.language, template_id=store.template_id, is_active=store.is_active,
        ),
        membership=result["membership"],
        theme=result["theme"],
        next_redirect=result["next_redirect"],
    )
