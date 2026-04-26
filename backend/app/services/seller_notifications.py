"""
Notificaciones al vendedor cuando se le asigna un chat.

Combina email (Resend) + WhatsApp interno (Evolution API) con un solo punto
de entrada. Tolerante a fallos: si un canal falla, los demás siguen.

Para WhatsApp interno reusamos la misma instance de Evolution que la tienda
usa para hablar con clientes. El mensaje lleva un prefijo claro
"🔔 [Asignación interna]" para que el vendedor lo distinga al toque.
"""

import asyncio
import json
import logging

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.ai import AIChannel, Conversation
from app.models.customer import Customer
from app.models.store import Store
from app.models.user import User
from app.services.email_service import send_chat_assignment_notification
from app.services.evolution_api import send_text_message

logger = logging.getLogger(__name__)


def _normalize_phone(phone: str | None) -> str | None:
    """Saca '+', espacios y guiones. Retorna None si queda vacio o muy corto."""
    if not phone:
        return None
    cleaned = "".join(ch for ch in phone if ch.isdigit())
    if len(cleaned) < 10 or len(cleaned) > 15:
        return None
    return cleaned


def _build_chat_url(store: Store, conversation_id: str) -> str:
    settings = get_settings()
    base = (settings.frontend_url or "https://getagentro.com").rstrip("/")
    return f"{base}/app/conversations?conv={conversation_id}&store={store.id}"


def _summary_preview(handoff_json: str | None) -> str:
    """Genera un preview cortito del handoff para email/WA."""
    if not handoff_json:
        return ""
    try:
        data = json.loads(handoff_json)
    except (json.JSONDecodeError, TypeError):
        return ""

    parts: list[str] = []
    customer = data.get("customer", {})
    interest = data.get("interest", {})
    pricing = data.get("pricing", {})

    products = interest.get("products") or []
    if products:
        parts.append(f"Producto: {', '.join(str(p) for p in products[:3])}")
    if interest.get("quantity"):
        parts.append(f"Cantidad: {interest['quantity']}")
    if pricing.get("quoted_total"):
        parts.append(f"Total cotizado: {pricing['quoted_total']} {pricing.get('currency', 'USD')}")
    if customer.get("city"):
        parts.append(f"Ciudad: {customer['city']}")

    objections = data.get("objections") or []
    if objections:
        parts.append(f"Objeciones: {'; '.join(str(o) for o in objections[:2])}")

    return " · ".join(parts)


def _send_whatsapp_internal(
    store_id: str,
    seller_phone: str,
    text: str,
    db: Session,
) -> bool:
    """
    Envia un WhatsApp al telefono del seller usando la instance de Evolution
    de la tienda (la misma que se usa para hablar con clientes).
    """
    channel = (
        db.query(AIChannel)
        .filter(
            AIChannel.store_id == store_id,
            AIChannel.channel_type == "whatsapp",
            AIChannel.is_active == True,
            AIChannel.connection_status == "connected",
        )
        .first()
    )
    if not channel or not channel.instance_name:
        logger.info(f"[notif] no whatsapp instance for store={store_id[:8]}, skipping WA notif")
        return False

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            send_text_message(
                instance_name=channel.instance_name,
                to_number=seller_phone,
                text=text,
                instance_token=channel.instance_token,
            )
        )
        logger.info(f"[notif] WA internal notification sent to seller {seller_phone[-4:]}")
        return True
    except Exception as exc:
        logger.warning(f"[notif] WA send failed: {exc}")
        return False
    finally:
        loop.close()


def notify_seller_of_assignment(
    db: Session,
    store: Store,
    seller: User,
    conversation: Conversation,
) -> dict[str, bool]:
    """
    Envia las notificaciones al vendedor cuando se le asigna un chat.
    Retorna {email_sent, whatsapp_sent} para auditing.
    """
    customer_name = "Cliente"
    if conversation.customer_id:
        customer = db.query(Customer).filter(Customer.id == conversation.customer_id).first()
        if customer:
            customer_name = (
                f"{customer.first_name or ''} {customer.last_name or ''}".strip()
                or customer.email
                or "Cliente"
            )

    # Sacar prioridad del handoff_summary si existe
    priority = "media"
    summary_preview = ""
    if conversation.handoff_summary:
        try:
            summary_data = json.loads(conversation.handoff_summary)
            priority = summary_data.get("priority", "media")
        except (json.JSONDecodeError, TypeError):
            pass
        summary_preview = _summary_preview(conversation.handoff_summary)

    chat_url = _build_chat_url(store, conversation.id)
    seller_name = seller.full_name or seller.email.split("@")[0]

    # ── Email ──
    email_sent = False
    if seller.email:
        try:
            email_sent = send_chat_assignment_notification(
                to_email=seller.email,
                seller_name=seller_name,
                store_name=store.name,
                customer_name=customer_name,
                handoff_priority=priority,
                chat_url=chat_url,
                summary_preview=summary_preview,
            )
        except Exception as exc:
            logger.warning(f"[notif] email send failed: {exc}")

    # ── WhatsApp interno ──
    whatsapp_sent = False
    seller_phone = _normalize_phone(seller.phone)
    if seller_phone:
        priority_emoji = {
            "vip": "🔥",
            "alta": "🟠",
            "media": "🟡",
            "baja": "🟢",
        }.get(priority, "🟡")

        wa_text = (
            f"🔔 *[Asignación interna]* {priority_emoji}\n"
            f"\n"
            f"Hola {seller_name}, te asignaron un chat de *{customer_name}* en {store.name}.\n"
            f"\n"
            + (f"📝 {summary_preview}\n\n" if summary_preview else "")
            + f"Abrir: {chat_url}\n"
            f"\n"
            f"_Este es un mensaje interno de Agentro, no del cliente._"
        )
        whatsapp_sent = _send_whatsapp_internal(
            store_id=store.id,
            seller_phone=seller_phone,
            text=wa_text,
            db=db,
        )
    else:
        logger.info(f"[notif] seller {seller.id[:8]} has no phone configured, WA notif skipped")

    return {"email_sent": email_sent, "whatsapp_sent": whatsapp_sent}
