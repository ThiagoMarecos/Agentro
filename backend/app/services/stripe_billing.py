"""
Servicio de Stripe para suscripciones SaaS de Agentro.

Responsable de:
  - Crear/obtener Stripe Customer por Store
  - Crear Subscriptions con trial 14 días (vía Checkout Session)
  - Cancelar / actualizar suscripciones
  - Sincronizar Products/Prices con los Plans de la DB
  - Procesar webhooks de Stripe (event handlers)

NO maneja:
  - Pagos del cliente final hacia la tienda (eso es payment_providers/stripe)
  - Lógica de feature gating (eso es core/feature_gating)

## Configuración requerida

En `.env`:
```
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_live_... (o sk_test_ para testing)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Flujo de alta de cliente

1. User entra a /pricing → elige plan → click "Empezar trial"
2. Frontend → POST /api/v1/billing/checkout con { tier, billing_period }
3. Backend → crea/recupera Stripe Customer + crea Checkout Session con trial=14d
4. Backend → devuelve { checkout_url }
5. Frontend redirect a checkout_url (Stripe-hosted)
6. User mete tarjeta → Stripe crea Subscription en estado "trialing"
7. Stripe envía webhook customer.subscription.created → marcamos Store con tier + trial_ends_at
8. Al día 14, Stripe cobra → invoice.payment_succeeded → status='active'
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.plan import Plan
from app.models.store import Store
from app.models.user import User

logger = logging.getLogger(__name__)

TRIAL_DAYS = 14


# ════════════════════════════════════════════════════════════════════
#  Helpers de inicialización
# ════════════════════════════════════════════════════════════════════

def _stripe():
    """
    Devuelve el módulo stripe configurado con la API key.
    Import lazy para no crashear si la lib no está instalada o la key
    no está seteada (caso hibernación).
    """
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise RuntimeError(
            "Stripe no configurado. Setear STRIPE_SECRET_KEY en .env "
            "o desactivar BILLING_ENABLED."
        )
    try:
        import stripe
    except ImportError:
        raise RuntimeError(
            "Lib 'stripe' no instalada. Correr `pip install stripe` "
            "o `pip install -r requirements.txt`."
        )
    stripe.api_key = settings.stripe_secret_key
    return stripe


# ════════════════════════════════════════════════════════════════════
#  Customer — crear / recuperar
# ════════════════════════════════════════════════════════════════════

def get_or_create_customer(db: Session, store: Store, owner: User) -> str:
    """
    Devuelve el stripe_customer_id de la store. Si no existe, lo crea
    en Stripe y lo persiste.
    """
    if store.stripe_customer_id:
        return store.stripe_customer_id

    stripe = _stripe()
    customer = stripe.Customer.create(
        email=owner.email,
        name=owner.full_name or owner.email,
        metadata={
            "store_id": store.id,
            "store_slug": store.slug,
            "user_id": owner.id,
        },
    )
    store.stripe_customer_id = customer.id
    db.add(store)
    db.commit()
    db.refresh(store)
    logger.info(f"[stripe] Customer creado para store {store.id}: {customer.id}")
    return customer.id


# ════════════════════════════════════════════════════════════════════
#  Checkout Session — alta con trial
# ════════════════════════════════════════════════════════════════════

def create_checkout_session(
    db: Session,
    store: Store,
    owner: User,
    plan: Plan,
    billing_period: str,
    success_url: str,
    cancel_url: str,
) -> dict[str, Any]:
    """
    Crea una Stripe Checkout Session para iniciar suscripción con trial.

    Args:
      billing_period: 'monthly' o 'yearly'
      success_url: URL absoluta a la que redirige post-checkout exitoso
      cancel_url: URL a la que redirige si el user cancela

    Returns:
      { 'checkout_url': str, 'session_id': str }
    """
    stripe = _stripe()

    price_id = (
        plan.stripe_price_monthly_id
        if billing_period == "monthly"
        else plan.stripe_price_yearly_id
    )
    if not price_id:
        raise RuntimeError(
            f"Plan '{plan.tier}' no tiene stripe_price_{billing_period}_id seteado. "
            f"Correr sync_plans_to_stripe() primero."
        )

    customer_id = get_or_create_customer(db, store, owner)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        subscription_data={
            "trial_period_days": TRIAL_DAYS,
            "metadata": {
                "store_id": store.id,
                "plan_tier": plan.tier,
            },
        },
        success_url=success_url,
        cancel_url=cancel_url,
        # Requerir tarjeta aunque haya trial (decisión confirmada por el user)
        payment_method_collection="always",
    )
    logger.info(
        f"[stripe] Checkout creado para store {store.id} tier={plan.tier} "
        f"billing={billing_period}: {session.id}"
    )
    return {"checkout_url": session.url, "session_id": session.id}


def create_billing_portal_session(db: Session, store: Store, return_url: str) -> str:
    """
    Devuelve URL del Stripe Billing Portal para que el dueño maneje su
    suscripción (cambiar tarjeta, ver facturas, cancelar).
    """
    if not store.stripe_customer_id:
        raise RuntimeError("Store sin stripe_customer_id (nunca pasó por checkout)")
    stripe = _stripe()
    session = stripe.billing_portal.Session.create(
        customer=store.stripe_customer_id,
        return_url=return_url,
    )
    return session.url


def cancel_subscription(db: Session, store: Store, at_period_end: bool = True) -> None:
    """
    Cancela la suscripción de la store. Por default cancela al final del período
    actual (el usuario sigue teniendo acceso hasta entonces). Si at_period_end=False,
    cancela inmediatamente y bloquea acceso al toque.
    """
    if not store.stripe_subscription_id:
        raise RuntimeError("Store sin suscripción activa")
    stripe = _stripe()
    if at_period_end:
        stripe.Subscription.modify(store.stripe_subscription_id, cancel_at_period_end=True)
    else:
        stripe.Subscription.delete(store.stripe_subscription_id)
        store.subscription_status = "canceled"
        db.add(store)
        db.commit()
    logger.info(f"[stripe] Cancel suscripción store {store.id} (at_period_end={at_period_end})")


# ════════════════════════════════════════════════════════════════════
#  Sync Plans ↔ Stripe Products/Prices
# ════════════════════════════════════════════════════════════════════

def sync_plans_to_stripe(db: Session) -> dict[str, Any]:
    """
    Por cada Plan activo, asegura que exista un Stripe Product + 2 Prices
    (monthly, yearly). Si ya existen los IDs en DB, solo verifica que el
    Price siga vigente. Si no, los crea y los guarda.

    Idempotente — se puede correr múltiples veces.

    Returns: resumen de operaciones por tier.
    """
    stripe = _stripe()
    plans = db.query(Plan).filter(Plan.is_active.is_(True)).all()
    summary: dict[str, Any] = {}

    for plan in plans:
        report: dict[str, str] = {}

        # 1) Product
        if not plan.stripe_product_id:
            product = stripe.Product.create(
                name=f"Agentro {plan.name}",
                description=plan.description or f"Plan {plan.name}",
                metadata={"tier": plan.tier},
            )
            plan.stripe_product_id = product.id
            report["product"] = f"created {product.id}"
        else:
            report["product"] = f"exists {plan.stripe_product_id}"

        # 2) Price mensual
        if not plan.stripe_price_monthly_id:
            price = stripe.Price.create(
                product=plan.stripe_product_id,
                unit_amount=plan.price_monthly_cents,
                currency="usd",
                recurring={"interval": "month"},
                metadata={"tier": plan.tier, "period": "monthly"},
            )
            plan.stripe_price_monthly_id = price.id
            report["price_monthly"] = f"created {price.id}"
        else:
            report["price_monthly"] = f"exists {plan.stripe_price_monthly_id}"

        # 3) Price anual
        if not plan.stripe_price_yearly_id:
            price = stripe.Price.create(
                product=plan.stripe_product_id,
                unit_amount=plan.price_yearly_cents,
                currency="usd",
                recurring={"interval": "year"},
                metadata={"tier": plan.tier, "period": "yearly"},
            )
            plan.stripe_price_yearly_id = price.id
            report["price_yearly"] = f"created {price.id}"
        else:
            report["price_yearly"] = f"exists {plan.stripe_price_yearly_id}"

        db.add(plan)
        summary[plan.tier] = report

    db.commit()
    logger.info(f"[stripe] sync_plans_to_stripe done: {summary}")
    return summary


# ════════════════════════════════════════════════════════════════════
#  Webhook handlers — actualizar estado en DB
# ════════════════════════════════════════════════════════════════════

def verify_webhook_signature(payload: bytes, sig_header: str) -> Any:
    """Verifica la firma del webhook y devuelve el evento parseado."""
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET no configurado")
    stripe = _stripe()
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )


def _store_from_subscription(db: Session, subscription_obj: Any) -> Store | None:
    """Recupera el Store asociado a una Stripe Subscription por customer_id
    o por metadata.store_id."""
    # Preferir metadata.store_id (más explícito)
    store_id = (subscription_obj.get("metadata") or {}).get("store_id")
    if store_id:
        store = db.query(Store).filter(Store.id == store_id).first()
        if store:
            return store
    # Fallback: por customer_id
    customer_id = subscription_obj.get("customer")
    if customer_id:
        return db.query(Store).filter(Store.stripe_customer_id == customer_id).first()
    return None


def _tier_from_subscription(subscription_obj: Any) -> str | None:
    """Extrae el tier del primer line item (asumimos 1 sub = 1 plan base)."""
    tier = (subscription_obj.get("metadata") or {}).get("plan_tier")
    if tier:
        return tier
    # Fallback: leer del Price metadata
    items = (subscription_obj.get("items") or {}).get("data") or []
    if items:
        price = items[0].get("price") or {}
        return (price.get("metadata") or {}).get("tier")
    return None


def handle_subscription_event(db: Session, event: dict) -> str:
    """
    Procesa eventos de tipo customer.subscription.*. Devuelve mensaje de log.
    """
    event_type = event.get("type", "")
    sub = (event.get("data") or {}).get("object") or {}

    store = _store_from_subscription(db, sub)
    if not store:
        return f"[stripe-webhook] {event_type}: store no encontrado"

    if event_type == "customer.subscription.deleted":
        store.subscription_status = "canceled"
        store.stripe_subscription_id = None
        db.add(store)
        db.commit()
        return f"[stripe-webhook] sub canceled: store={store.id}"

    # created o updated
    status = sub.get("status", "active")  # active|trialing|past_due|canceled|paused
    tier = _tier_from_subscription(sub)
    trial_end = sub.get("trial_end")

    if tier:
        store.subscription_tier = tier
    store.subscription_status = status
    store.stripe_subscription_id = sub.get("id")
    if trial_end:
        store.trial_ends_at = datetime.fromtimestamp(trial_end, tz=timezone.utc)

    db.add(store)
    db.commit()
    return (
        f"[stripe-webhook] sub {event_type}: store={store.id} tier={tier} status={status}"
    )


def handle_invoice_event(db: Session, event: dict) -> str:
    """Procesa invoice.payment_succeeded / invoice.payment_failed."""
    event_type = event.get("type", "")
    invoice = (event.get("data") or {}).get("object") or {}
    customer_id = invoice.get("customer")
    if not customer_id:
        return f"[stripe-webhook] {event_type}: invoice sin customer"

    store = db.query(Store).filter(Store.stripe_customer_id == customer_id).first()
    if not store:
        return f"[stripe-webhook] {event_type}: store no encontrado"

    if event_type == "invoice.payment_succeeded":
        store.subscription_status = "active"
    elif event_type == "invoice.payment_failed":
        store.subscription_status = "past_due"
    else:
        return f"[stripe-webhook] invoice event ignorado: {event_type}"

    db.add(store)
    db.commit()
    return f"[stripe-webhook] {event_type}: store={store.id}"
