"""
Servicio para interactuar con Evolution API v2 (WhatsApp).
Gestiona instancias, conexión QR, envío de mensajes y estado.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.config import get_dynamic_setting

logger = logging.getLogger(__name__)

WEBHOOK_EVENTS = [
    "MESSAGES_UPSERT",
    "CONNECTION_UPDATE",
    "QRCODE_UPDATED",
    "MESSAGES_MEDIA_UPDATE",
]


class EvolutionAPIError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def _base_url() -> str:
    url = get_dynamic_setting("evolution_api_url").rstrip("/")
    if not url:
        raise EvolutionAPIError("EVOLUTION_API_URL no configurada", 500)
    return url


def _headers() -> dict:
    key = get_dynamic_setting("evolution_api_key")
    if not key:
        raise EvolutionAPIError("EVOLUTION_API_KEY no configurada", 500)
    return {
        "Content-Type": "application/json",
        "apikey": key,
    }


def _instance_headers(instance_token: str | None = None) -> dict:
    """Headers con el apikey de la instancia si se tiene, o el global."""
    h = _headers()
    if instance_token:
        h["apikey"] = instance_token
    return h


async def create_instance(
    instance_name: str,
    webhook_url: str,
    webhook_secret: str | None = None,
) -> dict[str, Any]:
    """
    Crea una instancia de WhatsApp en Evolution API.
    Configura el webhook automáticamente para recibir mensajes.
    """
    payload: dict[str, Any] = {
        "instanceName": instance_name,
        "integration": "WHATSAPP-BAILEYS",
        "qrcode": True,
        "rejectCall": True,
        "msgCall": "No puedo atender llamadas, escríbeme por chat.",
        "groupsIgnore": True,
        "alwaysOnline": True,
        "readMessages": True,
        "readStatus": False,
        "syncFullHistory": False,
        "webhook": {
            "url": webhook_url,
            "byEvents": False,
            "base64": False,
            "events": WEBHOOK_EVENTS,
        },
    }

    if webhook_secret:
        payload["webhook"]["headers"] = {
            "x-webhook-secret": webhook_secret,
        }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/instance/create",
            json=payload,
            headers=_headers(),
        )

    if resp.status_code in (200, 201):
        return resp.json()

    logger.error(f"Evolution create_instance error: {resp.status_code} - {resp.text}")
    raise EvolutionAPIError(
        f"Error al crear instancia: {resp.text}",
        resp.status_code,
    )


async def connect_instance(instance_name: str) -> dict[str, Any]:
    """
    Solicita la conexión de una instancia (genera QR code).
    Retorna el QR code en base64 y el pairing code.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{_base_url()}/instance/connect/{instance_name}",
            headers=_headers(),
        )

    if resp.status_code == 200:
        return resp.json()

    logger.error(f"Evolution connect error: {resp.status_code} - {resp.text}")
    raise EvolutionAPIError(
        f"Error al conectar instancia: {resp.text}",
        resp.status_code,
    )


async def connect_instance_with_retry(
    instance_name: str,
    max_retries: int = 5,
    delay_seconds: float = 3.0,
) -> dict[str, Any]:
    """
    Solicita QR con reintentos. Baileys puede tardar varios segundos
    en inicializar y generar el QR después de crear la instancia.
    """
    last_result: dict[str, Any] = {}
    for attempt in range(max_retries):
        try:
            result = await connect_instance(instance_name)
            base64_qr = result.get("base64")
            code = result.get("code")
            pairing = result.get("pairingCode")

            if base64_qr or code or pairing:
                logger.info(f"QR obtained on attempt {attempt + 1}")
                return result

            last_result = result
            logger.info(f"QR attempt {attempt + 1}/{max_retries}: no QR yet (count={result.get('count', '?')})")
        except EvolutionAPIError as e:
            logger.warning(f"QR attempt {attempt + 1}/{max_retries} error: {e.message}")
            last_result = {"error": e.message}

        if attempt < max_retries - 1:
            await asyncio.sleep(delay_seconds)

    return last_result


async def get_connection_state(instance_name: str) -> dict[str, Any]:
    """Obtiene el estado de conexión de una instancia.
    Normaliza la respuesta para que siempre tenga 'state' en el nivel superior.
    Evolution API devuelve: {"instance": {"instanceName": "...", "state": "open"}}
    """
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{_base_url()}/instance/connectionState/{instance_name}",
            headers=_headers(),
        )

    if resp.status_code == 200:
        data = resp.json()
        instance_data = data.get("instance", {})
        if isinstance(instance_data, dict) and "state" in instance_data:
            data["state"] = instance_data["state"]
        return data

    logger.error(f"Evolution state error: {resp.status_code} - {resp.text}")
    raise EvolutionAPIError(
        f"Error al obtener estado: {resp.text}",
        resp.status_code,
    )


async def fetch_instance(instance_name: str) -> dict[str, Any] | None:
    """Obtiene información detallada de una instancia."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{_base_url()}/instance/fetchInstances",
            params={"instanceName": instance_name},
            headers=_headers(),
        )

    if resp.status_code == 200:
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0]
        return data if isinstance(data, dict) else None

    return None


async def send_text_message(
    instance_name: str,
    to_number: str,
    text: str,
    instance_token: str | None = None,
) -> dict[str, Any]:
    """
    Envía un mensaje de texto por WhatsApp.
    to_number debe incluir código de país sin '+' (ej: 584121234567).
    """
    payload = {
        "number": to_number,
        "text": text,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/message/sendText/{instance_name}",
            json=payload,
            headers=_instance_headers(instance_token),
        )

    if resp.status_code in (200, 201):
        return resp.json()

    logger.error(f"Evolution sendText error: {resp.status_code} - {resp.text}")
    raise EvolutionAPIError(
        f"Error al enviar mensaje: {resp.text}",
        resp.status_code,
    )


async def logout_instance(instance_name: str) -> dict[str, Any]:
    """Desconecta la instancia de WhatsApp (logout)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{_base_url()}/instance/logout/{instance_name}",
            headers=_headers(),
        )

    if resp.status_code == 200:
        return resp.json()

    raise EvolutionAPIError(
        f"Error al desconectar: {resp.text}",
        resp.status_code,
    )


async def delete_instance(instance_name: str) -> dict[str, Any]:
    """Elimina la instancia completamente de Evolution API."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.delete(
            f"{_base_url()}/instance/delete/{instance_name}",
            headers=_headers(),
        )

    if resp.status_code == 200:
        return resp.json()

    raise EvolutionAPIError(
        f"Error al eliminar instancia: {resp.text}",
        resp.status_code,
    )


async def send_image_message(
    instance_name: str,
    to_number: str,
    image_url: str,
    caption: str = "",
    instance_token: str | None = None,
) -> dict[str, Any]:
    """
    Envía una imagen por WhatsApp con caption opcional.
    image_url debe ser una URL pública accesible (https://...).
    """
    payload = {
        "number": to_number,
        "mediatype": "image",
        "mimetype": "image/jpeg",
        "caption": caption,
        "media": image_url,
        "fileName": "producto.jpg",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/message/sendMedia/{instance_name}",
            json=payload,
            headers=_instance_headers(instance_token),
        )

    if resp.status_code in (200, 201):
        return resp.json()

    logger.error(f"Evolution sendMedia error: {resp.status_code} - {resp.text}")
    raise EvolutionAPIError(
        f"Error al enviar imagen: {resp.text}",
        resp.status_code,
    )


async def get_media_base64(
    instance_name: str,
    message_key: dict,
) -> dict[str, Any]:
    """
    Descarga la media de un mensaje recibido y retorna en base64.
    Usado para procesar imágenes que envían los clientes por WhatsApp.
    """
    payload = {
        "message": {"key": message_key},
        "convertToMp4": False,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{_base_url()}/chat/getBase64FromMediaMessage/{instance_name}",
            json=payload,
            headers=_headers(),
        )

    if resp.status_code == 200:
        return resp.json()

    raise EvolutionAPIError(
        f"Error al descargar media: {resp.text}",
        resp.status_code,
    )


async def restart_instance(instance_name: str) -> dict[str, Any]:
    """Reinicia una instancia."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.put(
            f"{_base_url()}/instance/restart/{instance_name}",
            headers=_headers(),
        )

    if resp.status_code == 200:
        return resp.json()

    raise EvolutionAPIError(
        f"Error al reiniciar instancia: {resp.text}",
        resp.status_code,
    )
