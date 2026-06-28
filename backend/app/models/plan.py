"""
Modelo Plan — definición de los tiers de suscripción (Starter / Pro / Enterprise).

Cada Plan vive en la DB para que el super admin pueda ajustar precios y límites
sin redeploy. La key es `tier` (matchea con Store.subscription_tier).

Precios siempre en centavos USD (Integer) para evitar floating point. Para mostrar
en UI, dividir por 100.
"""

import json

from sqlalchemy import Column, String, Integer, Boolean, Text

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


# Catálogo de feature keys reconocidas por el feature gating.
# Cuando agregues una feature nueva, agregala acá y al features[] del Plan correspondiente.
FEATURE_KEYS = {
    "web_chat",                 # Canal web chat
    "ai_agent_pretrained",      # Agente con prompt curado por Agentro
    "handoff_human",            # Escalamiento a vendedor humano
    "whatsapp",                 # Canal WhatsApp (Evolution API)
    "guided_personalization",   # Form de personalización guiada (sin tocar prompt)
    "copilot_mode",             # Sugerencias del agente al vendedor humano
    "custom_prompt",            # Editor de prompt del agente (Enterprise)
    "flow_editor",              # Editor visual de diagrama de flujo (Enterprise)
    "rag_training",             # Entrenamiento custom con docs (Enterprise)
    "api_access",               # Acceso programático a la API REST (Enterprise)
    "white_label",              # Sin marca "Powered by Agentro" (Enterprise opcional)
}


class Plan(Base, UUIDMixin, TimestampMixin):
    """Plan de suscripción de la plataforma (Starter / Pro / Enterprise)."""

    __tablename__ = "plans"

    # Identificador del tier — matchea con Store.subscription_tier
    tier = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)

    # Precios base en centavos USD
    price_monthly_cents = Column(Integer, nullable=False)
    price_yearly_cents = Column(Integer, nullable=False)
    setup_fee_cents = Column(Integer, nullable=False, default=0)

    # Add-ons en centavos USD
    store_price_monthly_cents = Column(Integer, nullable=False)
    seller_extra_price_monthly_cents = Column(Integer, nullable=False, default=0)
    conversation_overage_price_cents = Column(Integer, nullable=False, default=0)

    # Límites incluidos en el plan base
    conversations_included_per_month = Column(Integer, nullable=False)
    sellers_included = Column(Integer, nullable=False)
    allow_extra_sellers = Column(Boolean, nullable=False, default=False)

    # Features que incluye el plan — JSON list de strings (FEATURE_KEYS)
    features = Column(Text, nullable=False)

    # Display
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Stripe IDs — se llenan al correr `stripe_billing.sync_plans_to_stripe()`
    # desde el super admin panel. Necesarios para crear subscriptions.
    stripe_product_id = Column(String(255), nullable=True)
    stripe_price_monthly_id = Column(String(255), nullable=True)
    stripe_price_yearly_id = Column(String(255), nullable=True)

    # ── Helpers ────────────────────────────────────────────────────────

    def features_list(self) -> list[str]:
        """Devuelve la lista de features parseada desde JSON."""
        try:
            return json.loads(self.features or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    def has_feature(self, feature_key: str) -> bool:
        """True si el plan incluye la feature indicada."""
        return feature_key in self.features_list()

    @property
    def price_monthly_usd(self) -> float:
        return self.price_monthly_cents / 100

    @property
    def price_yearly_usd(self) -> float:
        return self.price_yearly_cents / 100
