"""
Agent Tools: herramientas que los agentes IA pueden invocar via function calling.
Cada tool se registra con su definición OpenAI y su función ejecutora.
"""

from app.services.agent_tools.product_tools import (
    tool_product_search,
    tool_product_detail,
    tool_check_availability,
    tool_recommend_product,
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

ALL_TOOL_DEFINITIONS = (
    PRODUCT_TOOL_DEFINITIONS
    + ORDER_TOOL_DEFINITIONS
    + NOTEBOOK_TOOL_DEFINITIONS
    + NOTIFICATION_TOOL_DEFINITIONS
)

TOOL_EXECUTORS = {
    "product_search": tool_product_search,
    "product_detail": tool_product_detail,
    "check_availability": tool_check_availability,
    "recommend_product": tool_recommend_product,
    "estimate_shipping": tool_estimate_shipping,
    "create_payment_link": tool_create_payment_link,
    "create_order": tool_create_order,
    "update_notebook": tool_update_notebook,
    "move_stage": tool_move_stage,
    "notify_owner": tool_notify_owner,
}


# Tools de solo lectura que se habilitan por defecto (sin configuración explícita)
_DEFAULT_SAFE_TOOLS = {"product_search", "product_detail", "check_availability"}


def get_tools_for_agent(enabled_tools: list[str] | None) -> list[dict]:
    """
    Retorna las tools habilitadas para un agente.
    SECURITY: deny-by-default — si enabled_tools es None o vacío, solo se
    retornan tools de lectura seguras. Las tools destructivas (create_order,
    create_payment_link) requieren habilitación explícita en la config del agente.
    """
    if not enabled_tools:
        # Solo tools seguras de solo lectura por defecto
        return [t for t in ALL_TOOL_DEFINITIONS if t["function"]["name"] in _DEFAULT_SAFE_TOOLS]
    return [t for t in ALL_TOOL_DEFINITIONS if t["function"]["name"] in enabled_tools]
