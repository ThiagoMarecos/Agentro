"""
Billing API — endpoints del sistema de tiers / suscripción + Stripe.

Read endpoints (sin Stripe):
  GET  /billing/features      → features disponibles para la store actual
  GET  /billing/plans          → catálogo de planes (para pricing page, sin auth)
  GET  /billing/me             → resumen del estado de billing de la store

Stripe (cobro de la suscripción SaaS hacia el dueño):
  POST /billing/checkout       → Stripe Checkout Session con trial 14d
  POST /billing/portal         → URL del Stripe Billing Portal (gestión auto)
  POST /billing/cancel         → cancela suscripción (al fin de período)
  POST /billing/webhook        → handler para eventos Stripe (público, firma valida)

Super admin:
  POST /billing/sync-stripe    → crea/actualiza Products+Prices en Stripe
                                  (correr una vez antes de activar BILLING_ENABLED)

Cuando BILLING_ENABLED=False (hibernación):
  - /features siempre devuelve TODAS las features
  - /me marca is_hibernating=True
  - /checkout, /portal, /cancel devuelven 503 (sistema no activo)
  - /webhook sigue funcionando (para testing con stripe CLI)
"""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.config import get_settings
from app.core.dependencies import get_current_store, require_superadmin
from app.core.feature_flags import is_billing_enabled, is_hibernating
from app.core.feature_gating import (
    check_feature_access,
    count_active_sellers,
    get_plan_for_store,
    max_sellers_for_store,
)
from app.db.session import get_db
from app.models.plan import FEATURE_KEYS, Plan
from app.models.store import Store
from app.models.user import User
from app.services import stripe_billing

logger = logging.getLogger(__name__)

router = APIRouter()


def _serialize_plan(plan: Plan) -> dict:
    """Forma de display de un plan. Precios en centavos + helpers en USD."""
    return {
        "tier": plan.tier,
        "name": plan.name,
        "description": plan.description,
        "price_monthly_cents": plan.price_monthly_cents,
        "price_yearly_cents": plan.price_yearly_cents,
        "setup_fee_cents": plan.setup_fee_cents,
        "store_price_monthly_cents": plan.store_price_monthly_cents,
        "seller_extra_price_monthly_cents": plan.seller_extra_price_monthly_cents,
        "conversation_overage_price_cents": plan.conversation_overage_price_cents,
        "conversations_included_per_month": plan.conversations_included_per_month,
        "sellers_included": plan.sellers_included,
        "allow_extra_sellers": plan.allow_extra_sellers,
        "features": plan.features_list(),
        "is_active": plan.is_active,
        "sort_order": plan.sort_order,
    }


# ════════════════════════════════════════════════════════════════════
#  GET /features — features disponibles para la store actual
# ════════════════════════════════════════════════════════════════════

@router.get("/features")
def get_store_features(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Devuelve qué features tiene la store actual.

    Forma:
      {
        "available": ["web_chat", "whatsapp", ...],  # solo las que tiene
        "all_keys": ["web_chat", "whatsapp", ...],   # universe de features
        "is_hibernating": true|false,
        "tier": "starter|pro|enterprise",
        "is_beta_user": true|false
      }
    """
    available: list[str] = []
    for key in FEATURE_KEYS:
        if check_feature_access(db, store, key):
            available.append(key)

    return {
        "available": sorted(available),
        "all_keys": sorted(FEATURE_KEYS),
        "is_hibernating": is_hibernating(),
        "tier": store.subscription_tier,
        "is_beta_user": store.is_beta_user,
    }


# ════════════════════════════════════════════════════════════════════
#  GET /me — resumen completo del billing de la store
# ════════════════════════════════════════════════════════════════════

@router.get("/me")
def get_billing_summary(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Resumen completo: tier, status, trial, beta, límites y uso actual."""
    plan = get_plan_for_store(db, store)
    sellers_current = count_active_sellers(db, store)
    sellers_max = max_sellers_for_store(db, store)

    trial_active = False
    trial_ends_at = store.trial_ends_at
    if trial_ends_at is not None:
        if trial_ends_at.tzinfo is None:
            trial_ends_at = trial_ends_at.replace(tzinfo=timezone.utc)
        trial_active = datetime.now(timezone.utc) < trial_ends_at

    beta_active = False
    beta_until = store.beta_features_until
    if store.is_beta_user:
        if beta_until is None:
            beta_active = True
        else:
            if beta_until.tzinfo is None:
                beta_until = beta_until.replace(tzinfo=timezone.utc)
            beta_active = datetime.now(timezone.utc) < beta_until

    return {
        "is_hibernating": is_hibernating(),
        "tier": store.subscription_tier,
        "subscription_status": store.subscription_status,
        "agent_mode": store.agent_mode,
        "plan": _serialize_plan(plan) if plan else None,
        "trial": {
            "active": trial_active,
            "ends_at": store.trial_ends_at.isoformat() if store.trial_ends_at else None,
        },
        "beta": {
            "is_beta_user": store.is_beta_user,
            "active": beta_active,
            "features_until": store.beta_features_until.isoformat()
            if store.beta_features_until
            else None,
        },
        "usage": {
            "sellers_current": sellers_current,
            "sellers_included": plan.sellers_included if plan else 0,
            "sellers_max": sellers_max,
            "conversations_included_per_month": plan.conversations_included_per_month
            if plan
            else 0,
        },
    }


# ════════════════════════════════════════════════════════════════════
#  GET /plans — catálogo de planes para pricing page
# ════════════════════════════════════════════════════════════════════

@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    """
    Catálogo de planes activos ordenados por sort_order.
    Endpoint público — no requiere auth (se usa en /pricing).
    """
    plans = (
        db.query(Plan)
        .filter(Plan.is_active.is_(True))
        .order_by(Plan.sort_order.asc())
        .all()
    )
    return {"plans": [_serialize_plan(p) for p in plans]}


# ════════════════════════════════════════════════════════════════════
#  Stripe — Checkout / Portal / Cancel
# ════════════════════════════════════════════════════════════════════

def _require_billing_active():
    """Bloquea endpoints de Stripe cuando el sistema está en hibernación."""
    if not is_billing_enabled():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "BILLING_DISABLED",
                "message": "El sistema de billing está en hibernación. Setear BILLING_ENABLED=true para activar.",
            },
        )


class CheckoutRequest(BaseModel):
    tier: str = Field(description="starter | pro | enterprise")
    billing_period: str = Field(description="monthly | yearly")
    success_url: str
    cancel_url: str


@router.post("/checkout")
def create_checkout(
    payload: CheckoutRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Crea una Stripe Checkout Session para que el dueño meta tarjeta + arranque trial.
    Solo funciona cuando BILLING_ENABLED=True.
    """
    _require_billing_active()

    if payload.billing_period not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billing_period debe ser monthly|yearly")

    plan = db.query(Plan).filter(Plan.tier == payload.tier, Plan.is_active.is_(True)).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{payload.tier}' no existe")

    try:
        result = stripe_billing.create_checkout_session(
            db=db,
            store=store,
            owner=user,
            plan=plan,
            billing_period=payload.billing_period,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return result


@router.post("/portal")
def open_portal(
    request: Request,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Devuelve URL del Stripe Billing Portal para gestionar la suscripción
    (cambiar tarjeta, ver facturas, cancelar). UI hosteada por Stripe.
    """
    _require_billing_active()
    settings = get_settings()
    return_url = f"{settings.frontend_url.rstrip('/')}/app/settings"
    try:
        url = stripe_billing.create_billing_portal_session(db, store, return_url)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"portal_url": url}


class AgentModeRequest(BaseModel):
    mode: str = Field(description="'pretrained' o 'custom_flow'")


@router.post("/agent-mode")
def set_agent_mode(
    payload: AgentModeRequest,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Setea cómo opera el agente en esta store:
      - 'pretrained': usa el agente curado de Agentro (default).
      - 'custom_flow': sigue el AgentFlow activo de la store (requiere flow_editor en plan).
    """
    if payload.mode not in ("pretrained", "custom_flow"):
        raise HTTPException(status_code=400, detail="mode debe ser 'pretrained' o 'custom_flow'")

    if payload.mode == "custom_flow":
        # Gate por feature: solo planes con flow_editor
        if not check_feature_access(db, store, "flow_editor"):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FEATURE_NOT_AVAILABLE",
                    "message": "Usar un flow custom requiere plan Pro o superior.",
                },
            )

    store.agent_mode = payload.mode
    db.add(store)
    db.commit()
    return {"agent_mode": store.agent_mode}


@router.post("/cancel")
def cancel(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Cancela la suscripción al final del período actual (el dueño sigue teniendo
    acceso hasta entonces). Para cancelación inmediata, usar el billing portal.
    """
    _require_billing_active()
    try:
        stripe_billing.cancel_subscription(db, store, at_period_end=True)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "message": "Cancelación programada para fin de período"}


# ════════════════════════════════════════════════════════════════════
#  Super admin — sync de Plans a Stripe
# ════════════════════════════════════════════════════════════════════

@router.post("/sync-stripe")
def sync_stripe(
    user: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
):
    """
    Crea o verifica los Stripe Products + Prices de cada Plan. Idempotente.
    Correr UNA vez antes de activar BILLING_ENABLED, y cada vez que cambies precios.
    """
    try:
        summary = stripe_billing.sync_plans_to_stripe(db)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "summary": summary}


# ════════════════════════════════════════════════════════════════════
#  Webhook handler — eventos de Stripe
# ════════════════════════════════════════════════════════════════════

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handler de webhooks de Stripe. Valida firma con STRIPE_WEBHOOK_SECRET.

    Eventos manejados:
      - customer.subscription.created / updated / deleted
      - invoice.payment_succeeded / payment_failed

    Stripe reintenta automáticamente si no respondemos 2xx. Por eso este
    handler trata de no fallar y registrar errores en log para revisión.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe_billing.verify_webhook_signature(payload, sig_header)
    except Exception as e:
        logger.warning(f"[stripe-webhook] firma inválida: {e}")
        raise HTTPException(status_code=400, detail="Firma inválida")

    event_type = event.get("type", "")
    try:
        if event_type.startswith("customer.subscription."):
            msg = stripe_billing.handle_subscription_event(db, event)
        elif event_type.startswith("invoice."):
            msg = stripe_billing.handle_invoice_event(db, event)
        else:
            msg = f"[stripe-webhook] evento ignorado: {event_type}"
        logger.info(msg)
    except Exception as e:
        # Registrar y devolver 200 igual: si fallamos, Stripe reintentará pero
        # podemos perder eventos. Mejor estrategia: encolar y procesar async.
        logger.error(f"[stripe-webhook] error procesando {event_type}: {e}", exc_info=True)

    return {"received": True}
