"""
Endpoints de métodos de pago.

Rutas:
  GET    /payment-providers                — catálogo público (no requiere store)
  GET    /payment-providers/recommended    — providers + recomendados según país de la tienda
  GET    /payment-methods                  — métodos configurados de la tienda (CRUD)
  POST   /payment-methods                  — crear/activar uno nuevo
  PATCH  /payment-methods/{id}             — actualizar config / desactivar
  DELETE /payment-methods/{id}             — borrar
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store, require_role
from app.db.session import get_db
from app.models.payment import PaymentMethod
from app.models.store import Store
from app.models.user import RoleEnum, User
from app.schemas.payment import (
    CreatePaymentMethodRequest,
    PaymentMethodResponse,
    ProviderInfo,
    RecommendationResponse,
    UpdatePaymentMethodRequest,
)
from app.services.audit_service import log_action
from app.services.payment_providers import (
    PAYMENT_PROVIDERS,
    list_providers_for_country,
    recommend_for_country,
)
from app.services.platform_settings_service import encrypt_value, decrypt_value

logger = logging.getLogger(__name__)

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
#  Helpers
# ════════════════════════════════════════════════════════════════════

def _provider_info(key: str) -> dict | None:
    p = PAYMENT_PROVIDERS.get(key)
    if not p:
        return None
    return {"key": key, **p}


# Campos del config marcados como "secret" — los encriptamos en DB
def _secret_field_keys(provider_key: str) -> set[str]:
    p = PAYMENT_PROVIDERS.get(provider_key)
    if not p:
        return set()
    return {f["key"] for f in p.get("config_fields", []) if f.get("type") == "secret"}


def _encrypt_secrets(provider_key: str, config: dict) -> dict:
    """Encripta los valores marcados como secret. Retorna config nuevo."""
    secrets = _secret_field_keys(provider_key)
    if not secrets:
        return config
    out = dict(config)
    for k in secrets:
        if k in out and out[k] and not str(out[k]).startswith("__enc__"):
            try:
                out[k] = "__enc__" + encrypt_value(str(out[k]))
            except Exception as exc:
                logger.warning(f"[payment] could not encrypt {k}: {exc}")
    return out


def _redact_secrets(provider_key: str, config: dict) -> dict:
    """En GET, los secrets se devuelven enmascarados (****1234)."""
    secrets = _secret_field_keys(provider_key)
    if not secrets:
        return config
    out = dict(config)
    for k in secrets:
        if k in out and out[k]:
            raw = str(out[k])
            if raw.startswith("__enc__"):
                try:
                    decoded = decrypt_value(raw[len("__enc__"):])
                    out[k] = "****" + decoded[-4:] if len(decoded) > 4 else "****"
                except Exception:
                    out[k] = "****"
            else:
                out[k] = "****"
    return out


def _decode_method(method: PaymentMethod) -> PaymentMethodResponse:
    cfg: dict = {}
    if method.config:
        try:
            cfg = json.loads(method.config)
        except (json.JSONDecodeError, TypeError):
            cfg = {}
    cfg = _redact_secrets(method.provider, cfg)
    return PaymentMethodResponse(
        id=method.id,
        store_id=method.store_id,
        provider=method.provider,
        display_name=method.display_name,
        is_active=method.is_active,
        sort_order=method.sort_order,
        config=cfg,
        created_at=method.created_at,
    )


# ════════════════════════════════════════════════════════════════════
#  Catálogo de providers (read-only)
# ════════════════════════════════════════════════════════════════════

# NOTA: estos endpoints están bajo /payment-providers/* (registrados con ese prefix).
# Los registramos como un sub-router para que coexistan con /payment-methods.

providers_router = APIRouter()


@providers_router.get("", response_model=list[ProviderInfo])
def list_providers(
    country: str | None = None,
    user: User = Depends(get_current_user),
):
    """
    Lista todos los providers del catálogo, opcionalmente filtrados por país.
    No requiere X-Store-ID — es info global.
    """
    items = list_providers_for_country(country)
    return items


@providers_router.get("/recommended", response_model=RecommendationResponse)
def get_recommended(
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
):
    """
    Providers recomendados para el país de la tienda actual + lista filtrada
    de providers que aplican a ese país.
    """
    country = (store.country or "").upper() or None
    keys = recommend_for_country(country)
    providers = list_providers_for_country(country)
    return RecommendationResponse(
        country_code=country,
        recommended_keys=keys,
        providers=providers,
    )


# ════════════════════════════════════════════════════════════════════
#  CRUD de métodos de pago de una tienda
# ════════════════════════════════════════════════════════════════════

@router.get("", response_model=list[PaymentMethodResponse])
def list_methods(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Lista todos los métodos de pago de la tienda (activos y no)."""
    methods = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.store_id == store.id)
        .order_by(PaymentMethod.sort_order.asc(), PaymentMethod.created_at.asc())
        .all()
    )
    return [_decode_method(m) for m in methods]


@router.post("", response_model=PaymentMethodResponse)
def create_method(
    payload: CreatePaymentMethodRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea un método de pago (manager+)."""
    require_role(store, user, RoleEnum.MANAGER)

    if payload.provider not in PAYMENT_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Provider desconocido: {payload.provider}")

    # Validación: campos required del config deben venir
    provider = PAYMENT_PROVIDERS[payload.provider]
    for field in provider.get("config_fields", []):
        if field.get("required") and not payload.config.get(field["key"]):
            raise HTTPException(
                status_code=400,
                detail=f"Falta el campo requerido: {field['label']} ({field['key']})",
            )

    cfg = _encrypt_secrets(payload.provider, payload.config or {})

    method = PaymentMethod(
        store_id=store.id,
        provider=payload.provider,
        display_name=payload.display_name,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        config=json.dumps(cfg, ensure_ascii=False),
    )
    db.add(method)
    db.commit()
    db.refresh(method)

    log_action(
        db, "payment_method.created",
        user_id=user.id, store_id=store.id,
        resource_type="payment_method", resource_id=method.id,
        details={"provider": payload.provider},
    )
    return _decode_method(method)


@router.patch("/{method_id}", response_model=PaymentMethodResponse)
def update_method(
    method_id: str,
    payload: UpdatePaymentMethodRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Actualiza display_name / is_active / sort_order / config (manager+)."""
    require_role(store, user, RoleEnum.MANAGER)

    method = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.id == method_id, PaymentMethod.store_id == store.id)
        .first()
    )
    if not method:
        raise HTTPException(status_code=404, detail="Método no encontrado")

    if payload.display_name is not None:
        method.display_name = payload.display_name
    if payload.is_active is not None:
        method.is_active = payload.is_active
    if payload.sort_order is not None:
        method.sort_order = payload.sort_order
    if payload.config is not None:
        # Mergeamos con el config actual: si el cliente solo manda algunos campos,
        # mantenemos los demás. Para los secrets, si manda "****" lo ignoramos
        # (no sobrescribir con la mascara).
        existing: dict = {}
        if method.config:
            try:
                existing = json.loads(method.config)
            except (json.JSONDecodeError, TypeError):
                existing = {}
        secrets = _secret_field_keys(method.provider)
        merged = {**existing}
        for k, v in payload.config.items():
            if k in secrets and isinstance(v, str) and v.startswith("****"):
                continue  # no sobrescribir secret con su versión masked
            merged[k] = v
        method.config = json.dumps(_encrypt_secrets(method.provider, merged), ensure_ascii=False)

    db.add(method)
    db.commit()
    db.refresh(method)

    log_action(
        db, "payment_method.updated",
        user_id=user.id, store_id=store.id,
        resource_type="payment_method", resource_id=method.id,
    )
    return _decode_method(method)


@router.delete("/{method_id}", status_code=204)
def delete_method(
    method_id: str,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Borra un método de pago (manager+)."""
    require_role(store, user, RoleEnum.MANAGER)

    method = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.id == method_id, PaymentMethod.store_id == store.id)
        .first()
    )
    if not method:
        raise HTTPException(status_code=404, detail="Método no encontrado")

    db.delete(method)
    db.commit()

    log_action(
        db, "payment_method.deleted",
        user_id=user.id, store_id=store.id,
        resource_type="payment_method", resource_id=method_id,
    )
