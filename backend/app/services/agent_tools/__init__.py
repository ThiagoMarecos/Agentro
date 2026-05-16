"""
Agent Tools: herramientas que los agentes IA pueden invocar via function calling.
Cada tool se registra con su definición OpenAI y su función ejecutora.
"""

import logging

from app.services.agent_tools.product_tools import (
    tool_product_search,
    tool_product_detail,
    tool_check_availability,
    tool_recommend_product,
    tool_send_product_image,
    tool_send_product_gallery,
    tool_list_categories,
    PRODUCT_TOOL_DEFINITIONS,
)
from app.services.agent_tools.order_tools import (
    tool_estimate_shipping,
    tool_create_payment_link,
    tool_create_order,
    ORDER_TOOL_DEFINITIONS,
)
from app.services.agent_tools.notebook_tools import (
    tool_update_notebook,
    tool_move_stage,
    NOTEBOOK_TOOL_DEFINITIONS,
)
from app.services.agent_tools.notification_tools import (
    tool_notify_owner,
    NOTIFICATION_TOOL_DEFINITIONS,
)
from app.services.agent_tools.store_tools import (
    tool_get_store_info,
    tool_get_store_discounts,
    tool_escalate_to_human,
    tool_handoff_to_seller,
    STORE_TOOL_DEFINITIONS,
)

logger = logging.getLogger(__name__)

ALL_TOOL_DEFINITIONS = (
    PRODUCT_TOOL_DEFINITIONS
    + ORDER_TOOL_DEFINITIONS
    + NOTEBOOK_TOOL_DEFINITIONS
    + NOTIFICATION_TOOL_DEFINITIONS
    + STORE_TOOL_DEFINITIONS
)

TOOL_EXECUTORS = {
    "product_search": tool_product_search,
    "product_detail": tool_product_detail,
    "check_availability": tool_check_availability,
    "recommend_product": tool_recommend_product,
    "send_product_image": tool_send_product_image,
    "send_product_gallery": tool_send_product_gallery,
    "list_categories": tool_list_categories,
    "estimate_shipping": tool_estimate_shipping,
    # STUB — no implementado. NO incluir en agentes de producción hasta integrar gateway real.
    "create_payment_link": tool_create_payment_link,
    "create_order": tool_create_order,
    "update_notebook": tool_update_notebook,
    "move_stage": tool_move_stage,
    "notify_owner": tool_notify_owner,
    "get_store_info": tool_get_store_info,
    "get_store_discounts": tool_get_store_discounts,
    "escalate_to_human": tool_escalate_to_human,
    "handoff_to_seller": tool_handoff_to_seller,
}

# ── Tools habilitadas por defecto ──
# Lectura segura + notebook + stage + store info siempre disponibles.
# Las tools destructivas (create_order, create_payment_link) se habilitan
# automáticamente para el agente de ventas principal.
_DEFAULT_SAFE_TOOLS = {
    "product_search", "product_detail", "check_availability",
    "recommend_product", "send_product_image", "send_product_gallery",
    "list_categories",
    "get_store_info", "get_store_discounts",
    "update_notebook", "move_stage",
    "notify_owner", "escalate_to_human", "handoff_to_seller",
}

# Todas las tools — se usan cuando el agente tiene modo "full_sales"
ALL_TOOL_NAMES = set(TOOL_EXECUTORS.keys())


def get_tools_for_agent(enabled_tools: list[str] | None) -> list[dict]:
    """
    Retorna las tools habilitadas para un agente.
    - Si enabled_tools es None → tools seguras por defecto (lectura + notebook + store)
    - Si enabled_tools contiene "all" → TODAS las tools
    - De lo contrario → solo las tools listadas explícitamente
    """
    if not enabled_tools:
        return [t for t in ALL_TOOL_DEFINITIONS if t["function"]["name"] in _DEFAULT_SAFE_TOOLS]

    # Warning si se está habilitando el stub de payment link
    if "all" in enabled_tools or "create_payment_link" in enabled_tools:
        logger.warning(
            "⚠️ create_payment_link está habilitado pero es un STUB que devuelve URLs falsas. "
            "NO usar en producción."
        )

    if "all" in enabled_tools:
        return list(ALL_TOOL_DEFINITIONS)

    # Siempre incluir las safe tools + las explícitamente habilitadas
    allowed = _DEFAULT_SAFE_TOOLS | set(enabled_tools)
    return [t for t in ALL_TOOL_DEFINITIONS if t["function"]["name"] in allowed]
