"""
Feature gating — decide qué features puede usar cada Store según su tier.

Diseño:
  1. Si el sistema está en HIBERNACIÓN (BILLING_ENABLED=False), todo el gating
     devuelve True. Toda la app funciona como si todos fueran Enterprise.
  2. Si el Store es BETA USER con `beta_features_until` vigente, override de
     todas las features (lifetime/extended access para early adopters).
  3. Si la suscripción está CANCELED o PAUSED, denegar todo (forzar reactivación).
  4. En cualquier otro caso, chequear contra `Plan.features` del tier del store.

Las features están listadas en `app.models.plan.FEATURE_KEYS`. Cada tier tiene
un subset en su columna `features` (JSON list).

## Uso en endpoints FastAPI

```python
from app.core.feature_gating import requires_feature

@router.get("/agent/prompt")
def get_prompt(
    store: Store = requires_feature("custom_prompt"),
):
    ...
```

Si el store no tiene acceso → HTTPException 403 con código FEATURE_NOT_AVAILABLE.

## Uso en lógica de negocio

```python
from app.core.feature_gating import check_feature_access

if check_feature_access(db, store, "whatsapp"):
    enviar_por_whatsapp(...)
else:
    enviar_por_email(...)
```
"""

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.feature_flags import is_hibernating
from app.db.session import get_db
from app.models.plan import Plan
from app.models.store import Store, StoreMember
from app.models.user import RoleEnum


# ════════════════════════════════════════════════════════════════════
#  Helpers de lectura del Plan
# ════════════════════════════════════════════════════════════════════

def get_plan_for_store(db: Session, store: Store) -> Plan | None:
    """Devuelve el Plan correspondiente al tier de esta store (o None si no
    existe — caso raro que indica seeder no corrió o tier desconocido)."""
    if not store or not store.subscription_tier:
        return None
    return (
        db.query(Plan)
        .filter(Plan.tier == store.subscription_tier, Plan.is_active.is_(True))
        .first()
    )


def _is_beta_active(store: Store) -> bool:
    """True si el store es beta user con acceso aún vigente."""
    if not store or not store.is_beta_user:
        return False
    until = store.beta_features_until
    if until is None:
        # is_beta_user sin fecha = beta indefinida (decisión manual del super admin)
        return True
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) < until


def _subscription_is_blocked(store: Store) -> bool:
    """True si el estado de la suscripción no permite usar features."""
    return store.subscription_status in ("canceled", "paused")


# ════════════════════════════════════════════════════════════════════
#  API pública — Checks
# ════════════════════════════════════════════════════════════════════

def check_feature_access(db: Session, store: Store, feature_key: str) -> bool:
    """
    True si el `store` tiene acceso a la `feature_key` indicada.

    Orden de evaluación:
      1. Hibernación → True (todos tienen todo)
      2. Beta user con override vigente → True
      3. Suscripción canceled/paused → False
      4. Plan del tier incluye la feature → True/False según features[]
    """
    if is_hibernating():
        return True
    if _is_beta_active(store):
        return True
    if _subscription_is_blocked(store):
        return False
    plan = get_plan_for_store(db, store)
    if plan is None:
        return False
    return plan.has_feature(feature_key)


# ════════════════════════════════════════════════════════════════════
#  Helpers de límites de uso
# ════════════════════════════════════════════════════════════════════

def count_active_sellers(db: Session, store: Store) -> int:
    """Cantidad de vendedores (StoreMember con role=seller) actualmente activos."""
    return (
        db.query(StoreMember)
        .filter(
            StoreMember.store_id == store.id,
            StoreMember.role == RoleEnum.SELLER.value,
        )
        .count()
    )


def max_sellers_for_store(db: Session, store: Store) -> int:
    """
    Máximo de sellers permitido. Si el plan permite extras (allow_extra_sellers),
    no hay tope (lo limita Stripe via line items extras). Si no permite,
    devuelve sellers_included como tope duro.
    """
    plan = get_plan_for_store(db, store)
    if plan is None:
        return 0
    if plan.allow_extra_sellers:
        # Sin tope duro — el costo de cada extra va por Stripe
        return 10_000  # Tope arbitrario para evitar abuso
    return plan.sellers_included


def can_add_seller(db: Session, store: Store) -> tuple[bool, str | None]:
    """
    True si la store puede agregar un seller más, junto con la razón si no.
    Devuelve (can_add, reason_if_blocked).
    """
    if is_hibernating():
        return True, None
    if _is_beta_active(store):
        return True, None
    if _subscription_is_blocked(store):
        return False, "Suscripción inactiva. Reactivar para agregar vendedores."

    plan = get_plan_for_store(db, store)
    if plan is None:
        return False, "Plan no encontrado."

    current = count_active_sellers(db, store)
    if not plan.allow_extra_sellers and current >= plan.sellers_included:
        return False, (
            f"Tu plan {plan.name} incluye hasta {plan.sellers_included} vendedor(es). "
            f"Upgrade a Pro para agregar más."
        )
    # Pro/Enterprise siempre pueden agregar (con costo extra que va a Stripe)
    return True, None


# ════════════════════════════════════════════════════════════════════
#  Dependency injection — wrappers para FastAPI
# ════════════════════════════════════════════════════════════════════

def requires_feature(feature_key: str):
    """
    Dependency de FastAPI que verifica que el store actual tenga acceso a la
    feature indicada. Si no, levanta HTTPException 403 con código
    FEATURE_NOT_AVAILABLE.

    Uso:
        @router.get("/agent/prompt")
        def endpoint(store: Store = requires_feature("custom_prompt")):
            ...
    """
    # Importación tardía para evitar ciclos
    from app.core.dependencies import get_current_store

    def _check(
        store: Store = Depends(get_current_store),
        db: Session = Depends(get_db),
    ) -> Store:
        if not check_feature_access(db, store, feature_key):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FEATURE_NOT_AVAILABLE",
                    "feature": feature_key,
                    "message": (
                        f"Esta función no está disponible en tu plan actual. "
                        f"Upgrade para acceder a {feature_key}."
                    ),
                },
            )
        return store

    return Depends(_check)
