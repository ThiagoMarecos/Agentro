"""
Endpoints de tiendas.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.user import User
from app.models.store import Store, StoreMember
from pydantic import BaseModel as PydanticBaseModel
from app.schemas.store import StoreCreate, StoreResponse, StoreSettingsResponse, StoreSettingsUpdate
from app.services.store_service import create_store
from app.services.audit_service import log_action, get_client_info
from app.repos.store_repo import get_user_stores, get_by_id

router = APIRouter()


@router.get("/current", response_model=StoreResponse)
def get_current_store_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve la primera tienda del usuario (o 404 si no tiene)."""
    stores = get_user_stores(db, user.id)
    if not stores:
        raise HTTPException(status_code=404, detail="No tienes ninguna tienda")
    s = stores[0]
    return StoreResponse(
        id=s.id, name=s.name, slug=s.slug, description=s.description,
        industry=s.industry, country=s.country, currency=s.currency,
        language=s.language, template_id=s.template_id, is_active=s.is_active,
        logo_url=getattr(s, "logo_url", None),
        favicon_url=getattr(s, "favicon_url", None),
        og_image_url=getattr(s, "og_image_url", None),
    )


@router.get("/current/settings", response_model=StoreSettingsResponse)
def get_store_settings(
    store: Store = Depends(get_current_store),
):
    """Obtiene la configuración completa de la tienda actual (requiere X-Store-ID)."""
    return StoreSettingsResponse(
        id=store.id,
        name=store.name,
        slug=store.slug,
        description=store.description,
        industry=store.industry,
        business_type=getattr(store, "business_type", None),
        country=store.country,
        currency=store.currency,
        language=store.language,
        timezone=getattr(store, "timezone", None),
        template_id=store.template_id,
        is_active=store.is_active,
        support_email=getattr(store, "support_email", None),
        support_phone=getattr(store, "support_phone", None),
        logo_url=getattr(store, "logo_url", None),
        favicon_url=getattr(store, "favicon_url", None),
        og_image_url=getattr(store, "og_image_url", None),
        meta_title=getattr(store, "meta_title", None),
        meta_description=getattr(store, "meta_description", None),
        custom_domain=getattr(store, "custom_domain", None),
        domain_verified=getattr(store, "domain_verified", False),
    )


@router.patch("/current/settings", response_model=StoreSettingsResponse)
def update_store_settings(
    data: StoreSettingsUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza la configuración de la tienda (requiere X-Store-ID)."""
    import re

    update_data = data.model_dump(exclude_unset=True)

    if "slug" in update_data and update_data["slug"]:
        slug = update_data["slug"].strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$", slug):
            raise HTTPException(
                status_code=400,
                detail="Slug inválido. Use solo letras minúsculas, números y guiones.",
            )
        existing = db.query(Store).filter(Store.slug == slug, Store.id != store.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ese slug ya está en uso")
        update_data["slug"] = slug

    for key, value in update_data.items():
        setattr(store, key, value)

    db.commit()
    db.refresh(store)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "settings.update", user_id=user.id, store_id=store.id,
        resource_type="store", resource_id=store.id,
        details={"updated_fields": list(update_data.keys())},
        ip_address=ip, user_agent=user_agent,
    )

    return StoreSettingsResponse(
        id=store.id,
        name=store.name,
        slug=store.slug,
        description=store.description,
        industry=store.industry,
        business_type=getattr(store, "business_type", None),
        country=store.country,
        currency=store.currency,
        language=store.language,
        timezone=getattr(store, "timezone", None),
        template_id=store.template_id,
        is_active=store.is_active,
        support_email=getattr(store, "support_email", None),
        support_phone=getattr(store, "support_phone", None),
        logo_url=getattr(store, "logo_url", None),
        favicon_url=getattr(store, "favicon_url", None),
        og_image_url=getattr(store, "og_image_url", None),
        meta_title=getattr(store, "meta_title", None),
        meta_description=getattr(store, "meta_description", None),
        custom_domain=getattr(store, "custom_domain", None),
        domain_verified=getattr(store, "domain_verified", False),
    )


@router.get("", response_model=list[StoreResponse])
def list_my_stores(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista tiendas del usuario actual."""
    stores = get_user_stores(db, user.id)
    return [
        StoreResponse(
            id=s.id, name=s.name, slug=s.slug, description=s.description,
            industry=s.industry, country=s.country, currency=s.currency,
            language=s.language, template_id=s.template_id, is_active=s.is_active,
            logo_url=getattr(s, "logo_url", None),
            favicon_url=getattr(s, "favicon_url", None),
            og_image_url=getattr(s, "og_image_url", None),
        )
        for s in stores
    ]


@router.post("", response_model=StoreResponse)
def create_store_endpoint(
    data: StoreCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea una nueva tienda."""
    store = create_store(db, user.id, data)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "store.create", user_id=user.id, store_id=store.id,
        resource_type="store", resource_id=store.id,
        details={"name": store.name, "slug": store.slug},
        ip_address=ip, user_agent=user_agent,
    )

    return StoreResponse(
        id=store.id, name=store.name, slug=store.slug, description=store.description,
        industry=store.industry, country=store.country, currency=store.currency,
        language=store.language, template_id=store.template_id, is_active=store.is_active,
        logo_url=getattr(store, "logo_url", None),
        favicon_url=getattr(store, "favicon_url", None),
        og_image_url=getattr(store, "og_image_url", None),
    )


@router.delete("/{store_id}")
def delete_store(
    store_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Elimina una tienda y todos sus datos. Solo el owner puede hacerlo."""
    from app.models.order import Order

    member = db.query(StoreMember).filter(
        StoreMember.store_id == store_id,
        StoreMember.user_id == user.id,
        StoreMember.role == "owner",
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Solo el propietario puede eliminar la tienda")

    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    safe_statuses = {"delivered", "cancelled"}
    pending_orders = db.query(Order).filter(
        Order.store_id == store_id,
        ~Order.status.in_(safe_statuses),
    ).count()

    if pending_orders > 0:
        raise HTTPException(
            status_code=409,
            detail=f"No podés eliminar esta tienda porque tenés {pending_orders} pedido{'s' if pending_orders != 1 else ''} sin completar. Enviá o cancelá todos los pedidos pendientes antes de eliminar la tienda.",
        )

    db.delete(store)
    db.commit()
    return {"ok": True, "message": "Tienda eliminada"}


@router.get("/{store_id}", response_model=StoreResponse)
def get_store(
    store_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Obtiene una tienda por ID (valida membresía)."""
    member = db.query(StoreMember).filter(
        StoreMember.store_id == store_id,
        StoreMember.user_id == user.id,
    ).first()
    if not member:
        store = db.query(Store).filter(Store.slug == store_id).first()
        if store:
            member = db.query(StoreMember).filter(
                StoreMember.store_id == store.id,
                StoreMember.user_id == user.id,
            ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Sin acceso a esta tienda")

    store = get_by_id(db, member.store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")

    return StoreResponse(
        id=store.id, name=store.name, slug=store.slug, description=store.description,
        industry=store.industry, country=store.country, currency=store.currency,
        language=store.language, template_id=store.template_id, is_active=store.is_active,
        logo_url=getattr(store, "logo_url", None),
        favicon_url=getattr(store, "favicon_url", None),
        og_image_url=getattr(store, "og_image_url", None),
    )


# ── Domain management ──────────────────────────────────────

class DomainSetupRequest(PydanticBaseModel):
    domain: str


class DomainStatusResponse(PydanticBaseModel):
    custom_domain: str | None
    domain_verified: bool
    nexora_subdomain: str
    dns_target: str
    required_records: list[dict]


@router.post("/current/domain")
def setup_custom_domain(
    data: DomainSetupRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Set or update the custom domain for the current store."""
    import re as _re

    domain = data.domain.strip().lower()
    domain = _re.sub(r"^https?://", "", domain)
    domain = domain.rstrip("/")

    if not _re.match(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", domain):
        raise HTTPException(status_code=400, detail="Dominio invalido. Ejemplo: mitienda.com")

    existing = db.query(Store).filter(
        Store.custom_domain == domain,
        Store.id != store.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Este dominio ya esta en uso por otra tienda")

    store.custom_domain = domain
    store.domain_verified = False
    db.commit()
    db.refresh(store)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "domain.setup", user_id=user.id, store_id=store.id,
        resource_type="store", resource_id=store.id,
        details={"domain": domain},
        ip_address=ip, user_agent=user_agent,
    )

    return _build_domain_status(store)


@router.get("/current/domain", response_model=DomainStatusResponse)
def get_domain_status(
    store: Store = Depends(get_current_store),
):
    """Get the domain configuration status."""
    return _build_domain_status(store)


@router.post("/current/domain/verify")
def verify_domain(
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Verify DNS configuration for the custom domain."""
    import socket

    domain = getattr(store, "custom_domain", None)
    if not domain:
        raise HTTPException(status_code=400, detail="No hay dominio configurado")

    target = "nexora-stores.vercel.app"
    verified = False
    dns_result = None

    try:
        import subprocess
        result = subprocess.run(
            ["nslookup", "-type=CNAME", domain],
            capture_output=True, text=True, timeout=10,
        )
        output = result.stdout.lower()
        if target in output:
            verified = True
            dns_result = "CNAME verificado correctamente"
        else:
            try:
                resolved = socket.gethostbyname(domain)
                dns_result = f"El dominio apunta a {resolved}. Necesita apuntar a {target}"
            except socket.gaierror:
                dns_result = "El dominio no resuelve. Los cambios DNS pueden tardar hasta 48 horas."
    except Exception as e:
        dns_result = f"No se pudo verificar: {str(e)[:100]}"

    store.domain_verified = verified
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "domain.verify", user_id=user.id, store_id=store.id,
        resource_type="store", resource_id=store.id,
        details={"domain": domain, "verified": verified, "result": dns_result},
        ip_address=ip, user_agent=user_agent,
    )

    return {"verified": verified, "domain": domain, "message": dns_result}


@router.delete("/current/domain")
def remove_custom_domain(
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Remove the custom domain."""
    old_domain = getattr(store, "custom_domain", None)
    store.custom_domain = None
    store.domain_verified = False
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "domain.remove", user_id=user.id, store_id=store.id,
        resource_type="store", resource_id=store.id,
        details={"removed_domain": old_domain},
        ip_address=ip, user_agent=user_agent,
    )

    return {"ok": True, "message": "Dominio desvinculado"}


def _build_domain_status(store: Store) -> DomainStatusResponse:
    domain = getattr(store, "custom_domain", None)
    target = "nexora-stores.vercel.app"
    records = []
    if domain:
        records.append({
            "type": "CNAME",
            "name": domain,
            "value": target,
            "description": f"Apunta tu dominio a {target}",
        })
    return DomainStatusResponse(
        custom_domain=domain,
        domain_verified=getattr(store, "domain_verified", False),
        nexora_subdomain=f"{store.slug}.nexora.app",
        dns_target=target,
        required_records=records,
    )
