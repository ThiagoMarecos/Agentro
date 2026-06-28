"""
Seeder de Plans — crea los 3 tiers default (Starter / Pro / Enterprise) si no
existen. Idempotente: se puede correr en cada startup sin duplicar data.

Para modificar precios o features de un plan después del primer seed, hay que
editarlos en la DB (vía /super-admin) — el seeder NO sobreescribe planes
existentes para no pisar cambios manuales.
"""

import json
import logging

from sqlalchemy.orm import Session

from app.models.plan import Plan

logger = logging.getLogger(__name__)


DEFAULT_PLANS = [
    {
        "tier": "starter",
        "name": "Starter",
        "description": "Para emprendedores que quieren empezar a vender con un agente IA pre-entrenado.",
        # Precios
        "price_monthly_cents": 2900,        # $29
        "price_yearly_cents": 31300,        # $313  (10% off vs $348 mensual×12)
        "setup_fee_cents": 0,
        # Add-ons
        "store_price_monthly_cents": 1000,  # $10 por tienda extra (y la primera)
        "seller_extra_price_monthly_cents": 0,  # No permite — forzar upgrade a Pro
        "conversation_overage_price_cents": 5,   # $0.05 por conversación extra
        # Límites incluidos
        "conversations_included_per_month": 200,
        "sellers_included": 1,
        "allow_extra_sellers": False,
        # Features
        "features": [
            "web_chat",
            "ai_agent_pretrained",
            "handoff_human",
        ],
        "sort_order": 1,
    },
    {
        "tier": "pro",
        "name": "Pro",
        "description": "Para tiendas en crecimiento con múltiples canales, vendedores y personalización guiada.",
        "price_monthly_cents": 9900,        # $99
        "price_yearly_cents": 106900,       # $1069 (10% off vs $1188 mensual×12)
        "setup_fee_cents": 0,
        "store_price_monthly_cents": 1500,  # $15 por tienda
        "seller_extra_price_monthly_cents": 200,  # $2 por vendedor extra
        "conversation_overage_price_cents": 4,
        "conversations_included_per_month": 1500,
        "sellers_included": 5,
        "allow_extra_sellers": True,
        "features": [
            "web_chat",
            "ai_agent_pretrained",
            "handoff_human",
            "whatsapp",
            "guided_personalization",
            "copilot_mode",
            "flow_editor",   # ← Pro también puede armar su flow custom
            "custom_prompt", # ← Pro puede tocar el prompt (Enterprise = RAG + más cosas)
        ],
        "sort_order": 2,
    },
    {
        "tier": "enterprise",
        "name": "Enterprise",
        "description": "Control total: prompt custom, diagrama de flujo, entrenamiento con tus docs (RAG), API y white-label.",
        "price_monthly_cents": 49900,       # desde $499
        "price_yearly_cents": 538900,       # desde $5389 (10% off)
        "setup_fee_cents": 80000,           # $800 setup one-time (incluye onboarding personalizado)
        "store_price_monthly_cents": 2500,  # $25 por tienda (más features = más costo)
        "seller_extra_price_monthly_cents": 200,  # $2 por vendedor extra
        "conversation_overage_price_cents": 3,
        "conversations_included_per_month": 10000,
        "sellers_included": 20,
        "allow_extra_sellers": True,
        "features": [
            "web_chat",
            "ai_agent_pretrained",
            "handoff_human",
            "whatsapp",
            "guided_personalization",
            "copilot_mode",
            "custom_prompt",
            "flow_editor",
            "rag_training",
            "api_access",
            "white_label",
        ],
        "sort_order": 3,
    },
]


def seed_plans(db: Session) -> int:
    """
    Inserta los 3 planes default si no existen.
    Devuelve la cantidad de planes creados (0 si ya existían todos).
    """
    created = 0
    for spec in DEFAULT_PLANS:
        existing = db.query(Plan).filter(Plan.tier == spec["tier"]).first()
        if existing:
            continue
        plan = Plan(
            tier=spec["tier"],
            name=spec["name"],
            description=spec["description"],
            price_monthly_cents=spec["price_monthly_cents"],
            price_yearly_cents=spec["price_yearly_cents"],
            setup_fee_cents=spec["setup_fee_cents"],
            store_price_monthly_cents=spec["store_price_monthly_cents"],
            seller_extra_price_monthly_cents=spec["seller_extra_price_monthly_cents"],
            conversation_overage_price_cents=spec["conversation_overage_price_cents"],
            conversations_included_per_month=spec["conversations_included_per_month"],
            sellers_included=spec["sellers_included"],
            allow_extra_sellers=spec["allow_extra_sellers"],
            features=json.dumps(sorted(spec["features"])),
            sort_order=spec["sort_order"],
            is_active=True,
        )
        db.add(plan)
        created += 1
    if created:
        db.commit()
        logger.info(f"[plans-seeder] {created} plan(s) creados")
    return created
