"""
Webhook para recibir eventos de Evolution API (WhatsApp).
Este endpoint es público (sin auth) ya que lo llama Evolution API.
"""

import json
import logging
import asyncio

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ai import AIChannel
from app.services.agent_runtime import process_message
from app.services.evolution_api import send_text_message

logger = logging.getLogger(__name__)

router = APIRouter()


def _extract_message_data(body: dict) -> dict | None:
    """
    Extrae los datos relevantes de un evento MESSAGES_UPSERT de Evolution API.
    Retorna None si no es un mensaje de texto entrante válido.
    """
    event = body.get("event")
    if event != "MESSAGES_UPSERT":
        return None

    data = body.get("data", {})

    if data.get("messageType") != "conversation" and data.get("messageType") != "extendedTextMessage":
        return None

    key = data.get("key", {})
    if key.get("fromMe"):
        return None

    remote_jid = key.get("remoteJid", "")
    if not remote_jid or remote_jid.endswith("@g.us"):
        return None

    phone_number = remote_jid.split("@")[0]

    message_obj = data.get("message", {})
    text = (
        message_obj.get("conversation")
        or message_obj.get("extendedTextMessage", {}).get("text")
        or ""
    )

    if not text.strip():
        return None

    instance_name = body.get("instance")

    return {
        "phone_number": phone_number,
        "text": text.strip(),
        "instance_name": instance_name,
        "message_id": key.get("id"),
    }


def _process_whatsapp_message(
    instance_name: str,
    phone_number: str,
    text: str,
    store_id: str,
    instance_token: str | None,
):
    """
    Procesa un mensaje de WhatsApp en background:
    1. Ejecuta AgentRuntime con el mensaje
    2. Envía la respuesta por WhatsApp
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        result = process_message(
            db=db,
            store_id=store_id,
            channel="whatsapp",
            customer_identifier=phone_number,
            message=text,
        )

        response_text = result.get("response", "")
        if response_text:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    send_text_message(
                        instance_name=instance_name,
                        to_number=phone_number,
                        text=response_text,
                        instance_token=instance_token,
                    )
                )
            finally:
                loop.close()

    except Exception as e:
        logger.error(f"Error processing WhatsApp message: {e}", exc_info=True)
    finally:
        db.close()


@router.post("/webhook/whatsapp")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Recibe eventos de Evolution API.
    Solo procesa MESSAGES_UPSERT (mensajes entrantes de texto).
    Busca el AIChannel por instance_name para identificar la tienda.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info(f"WEBHOOK_BODY: {json.dumps(body)[:2000]}")

    event = body.get("event")
    instance_name = body.get("instance")

    if not instance_name:
        raise HTTPException(status_code=400, detail="Missing instance name")

    # Buscar canal antes de procesar cualquier evento
    channel = db.query(AIChannel).filter(
        AIChannel.instance_name == instance_name,
    ).first()

    if not channel:
        logger.warning(f"No channel found for instance: {instance_name}")
        raise HTTPException(status_code=404, detail="Canal no encontrado")

    # SECURITY: validar secret ANTES de procesar cualquier evento, incluido CONNECTION_UPDATE
    # Canal sin secret configurado rechaza todas las llamadas
    webhook_secret = request.headers.get("x-webhook-secret")
    if not channel.webhook_secret:
        logger.warning(f"Channel {instance_name} has no webhook_secret — rejecting request")
        raise HTTPException(status_code=403, detail="Webhook secret no configurado en el canal")
    if webhook_secret != channel.webhook_secret:
        logger.warning(f"Invalid webhook secret for instance: {instance_name}")
        raise HTTPException(status_code=403, detail="Webhook secret inválido")

    if event == "CONNECTION_UPDATE":
        data = body.get("data", {})
        state = data.get("state", "").lower()
        if state == "open":
            channel.connection_status = "connected"
        elif state in ("close", "closed"):
            channel.connection_status = "disconnected"
        else:
            channel.connection_status = state
        db.commit()
        return {"status": "ok"}

    if event == "QRCODE_UPDATED":
        return {"status": "ok"}

    msg_data = _extract_message_data(body)
    if not msg_data:
        return {"status": "ignored"}

    if not channel.is_active:
        return {"status": "channel_inactive"}

    if channel.channel_type != "whatsapp":
        return {"status": "ignored"}

    background_tasks.add_task(
        _process_whatsapp_message,
        instance_name=msg_data["instance_name"],
        phone_number=msg_data["phone_number"],
        text=msg_data["text"],
        store_id=channel.store_id,
        instance_token=channel.instance_token,
    )

    return {"status": "processing"}
