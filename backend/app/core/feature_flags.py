"""
Feature flags globales del sistema.

Punto único donde se decide si features que afectan a TODO el sistema están
prendidas o apagadas. NO confundir con feature gating por tier (Pro/Enterprise),
que vive en `app.core.feature_gating`.

## BILLING_ENABLED

Controla si el sistema de planes/tiers/facturación está activo.

- False (default, modo "hibernación"):
  * El feature gating siempre devuelve True para todos los stores.
  * La página /pricing pública queda oculta (404).
  * El onboarding no pregunta por tier.
  * Stripe Subscriptions no se invoca al crear store.
  * Los límites (max_sellers, max_conversations) no se chequean.
  * El super admin panel de descuentos sigue funcionando para que vos puedas
    pre-cargar descuentos lifetime para early adopters cuando lances.

- True (sistema activo):
  * Gating completo según el tier de cada tienda.
  * Pricing y onboarding piden tier.
  * Trial 14 días con tarjeta arranca al crear store.
  * Stripe webhook actualiza tier/status.

Diseño: se prende sin cambios de código, solo seteando BILLING_ENABLED=true
en el .env y reiniciando el backend.
"""

from app.config import get_settings


def is_billing_enabled() -> bool:
    """True si el sistema de tiers/billing está activo."""
    return get_settings().billing_enabled


def is_hibernating() -> bool:
    """True si el sistema está en modo hibernación (billing apagado)."""
    return not is_billing_enabled()
