"""
Endpoints para gestionar la integración WhatsApp/Evolution API.
Cada tienda tiene su propia instancia independiente.
"""

import uuid
import secrets
import logging
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import Store
from app.models.ai import AIChannel
from app.core.dependencies import get_current_store
from app.config import get_settings
from app.services import evolution_api

logger = logging.getLogger(__name__)
router = APIRouter()


class WhatsAppConnectRequest(BaseModel):
    phone_number: str | None = None


class WhatsAppStatusResponse(BaseModel):
    id: str
    store_id: str
    channel_type: str
    is_active: bool
    instance_name: str | None
    whatsapp_number: str | None
    connection_status: str | None
    profile_name: str | None = None

    class Config:
        from_attributes = True


class ConnectResponse(BaseModel):
    channel_id: str
    instance_name: str
    qr_code: str | None = None
    pairing_code: str | None = None
    status: str
    message: str


class QRCodeResponse(BaseModel):
    qr_code: str | None = None
    pairing_code: str | None = None
    instance_name: str
    status: str


@router.get("/status", response_model=WhatsAppStatusResponse | None)
async def get_whatsapp_status(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene el estado actual de WhatsApp, sincronizando con Evolution API."""
    channel = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    instance_name = f"nexora-{store.slug}"

    if channel and channel.instance_name and channel.connection_status != "connected":
        try:
            state = await evolution_api.get_connection_state(channel.instance_name)
            if state.get("state") == "open":
                channel.connection_status = "connected"
                db.commit()
                db.refresh(channel)
        except evolution_api.EvolutionAPIError:
            pass

    if not channel:
        try:
            instance_info = await evolution_api.fetch_instance(instance_name)
            if instance_info:
                conn_status = instance_info.get("connectionStatus", "")
                token = instance_info.get("token", "")
                owner = instance_info.get("ownerJid", "") or ""
                number = owner.split("@")[0] if "@" in owner else None

                channel = AIChannel(
                    id=str(uuid.uuid4()),
                    store_id=store.id,
                    channel_type="whatsapp",
                    is_active=True,
                    instance_name=instance_name,
                    instance_token=token,
                    webhook_secret="",
                    whatsapp_number=number,
                    connection_status="connected" if conn_status == "open" else conn_status,
                )
                db.add(channel)
                db.commit()
                db.refresh(channel)
        except Exception:
            pass

    if not channel:
        return None

    profile_name = None
    if channel.connection_status == "connected" and channel.instance_name:
        try:
            info = await evolution_api.fetch_instance(channel.instance_name)
            if info:
                profile_name = info.get("profileName")
                owner = info.get("ownerJid", "") or ""
                if "@" in owner and not channel.whatsapp_number:
                    channel.whatsapp_number = owner.split("@")[0]
                    db.commit()
                    db.refresh(channel)
        except Exception:
            pass

    resp = WhatsAppStatusResponse.model_validate(channel)
    resp.profile_name = profile_name
    return resp


@router.post("/connect", response_model=ConnectResponse)
async def connect_whatsapp(
    payload: WhatsAppConnectRequest,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Conecta WhatsApp para la tienda:
    1. Elimina instancia anterior si existe
    2. Crea instancia nueva con webhook configurado
    3. Genera QR code para escanear
    """
    settings = get_settings()
    instance_name = f"nexora-{store.slug}"
    webhook_secret = secrets.token_urlsafe(32)
    webhook_url = f"{settings.backend_url}/api/v1/whatsapp-webhook/webhook/whatsapp"

    try:
        await evolution_api.delete_instance(instance_name)
    except evolution_api.EvolutionAPIError:
        pass

    try:
        result = await evolution_api.create_instance(
            instance_name=instance_name,
            webhook_url=webhook_url,
            webhook_secret=webhook_secret,
        )
    except evolution_api.EvolutionAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Error al crear instancia: {e.message}")

    hash_data = result.get("hash", "")
    instance_token = hash_data.get("apikey", "") if isinstance(hash_data, dict) else str(hash_data or "")

    existing = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    if existing:
        existing.instance_name = instance_name
        existing.instance_token = instance_token
        existing.webhook_secret = webhook_secret
        existing.whatsapp_number = payload.phone_number
        existing.connection_status = "connecting"
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        channel = existing
    else:
        channel = AIChannel(
            id=str(uuid.uuid4()),
            store_id=store.id,
            channel_type="whatsapp",
            is_active=True,
            instance_name=instance_name,
            instance_token=instance_token,
            webhook_secret=webhook_secret,
            whatsapp_number=payload.phone_number,
            connection_status="connecting",
        )
        db.add(channel)
        db.commit()
        db.refresh(channel)

    await asyncio.sleep(2)

    qr_code = None
    pairing_code = None
    try:
        qr_result = await evolution_api.connect_instance_with_retry(
            instance_name, max_retries=6, delay_seconds=3.0
        )
        qr_code = qr_result.get("base64")
        raw_pairing = qr_result.get("pairingCode") or ""
        pairing_code = raw_pairing if raw_pairing and len(raw_pairing) <= 12 else None
    except Exception as e:
        logger.error(f"QR generation failed for {instance_name}: {e}")

    return ConnectResponse(
        channel_id=channel.id,
        instance_name=instance_name,
        qr_code=qr_code,
        pairing_code=pairing_code,
        status="qr_ready" if qr_code else "connecting",
        message="Escaneá el código QR con WhatsApp" if qr_code else "Instancia creada. Hacé click en 'Generar QR'.",
    )


@router.get("/qr", response_model=QRCodeResponse)
async def get_qr_code(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Genera un nuevo QR code para conectar WhatsApp.
    Si la instancia no existe en Evolution API (ej: después de un reinicio),
    la recrea automáticamente antes de generar el QR.
    """
    import secrets as _secrets

    channel = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    if not channel or not channel.instance_name:
        raise HTTPException(status_code=404, detail="Primero conectá WhatsApp")

    try:
        state_result = await evolution_api.get_connection_state(channel.instance_name)
        if state_result.get("state") == "open":
            channel.connection_status = "connected"
            db.commit()
            return QRCodeResponse(instance_name=channel.instance_name, status="already_connected")
    except evolution_api.EvolutionAPIError:
        pass

    # Si la instancia no existe en Evolution API (ej: tras reinicio del contenedor),
    # la recreamos automáticamente antes de intentar generar el QR.
    instance_exists = await evolution_api.fetch_instance(channel.instance_name) is not None

    if not instance_exists:
        logger.info(
            f"Instance {channel.instance_name} not found in Evolution API — recreating automatically"
        )
        settings = get_settings()
        webhook_secret = channel.webhook_secret or _secrets.token_urlsafe(32)
        webhook_url = f"{settings.backend_url}/api/v1/whatsapp-webhook/webhook/whatsapp"

        try:
            create_result = await evolution_api.create_instance(
                instance_name=channel.instance_name,
                webhook_url=webhook_url,
                webhook_secret=webhook_secret,
            )
            hash_data = create_result.get("hash", "")
            instance_token = (
                hash_data.get("apikey", "") if isinstance(hash_data, dict) else str(hash_data or "")
            )
            channel.instance_token = instance_token
            channel.webhook_secret = webhook_secret
            channel.connection_status = "connecting"
            db.commit()
            db.refresh(channel)
            logger.info(f"Instance {channel.instance_name} recreated successfully")
            await asyncio.sleep(3)
        except evolution_api.EvolutionAPIError as e:
            logger.error(f"Failed to recreate instance {channel.instance_name}: {e.message}")
            raise HTTPException(
                status_code=e.status_code,
                detail=f"Error al recrear instancia: {e.message}",
            )

    try:
        result = await evolution_api.connect_instance_with_retry(
            channel.instance_name, max_retries=5, delay_seconds=3.0
        )
    except evolution_api.EvolutionAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    base64_qr = result.get("base64")
    raw_pairing = result.get("pairingCode") or ""
    pairing_code = raw_pairing if raw_pairing and len(raw_pairing) <= 12 else None

    if not base64_qr and not pairing_code:
        try:
            state_check = await evolution_api.get_connection_state(channel.instance_name)
            if state_check.get("state") == "open":
                channel.connection_status = "connected"
                db.commit()
                return QRCodeResponse(instance_name=channel.instance_name, status="already_connected")
        except evolution_api.EvolutionAPIError:
            pass

    return QRCodeResponse(
        qr_code=base64_qr,
        pairing_code=pairing_code,
        instance_name=channel.instance_name,
        status="waiting_scan" if base64_qr else "no_qr",
    )


@router.get("/connection-state")
async def get_connection_state(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Consulta el estado de conexión en tiempo real."""
    channel = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    if not channel or not channel.instance_name:
        raise HTTPException(status_code=404, detail="WhatsApp no configurado")

    try:
        result = await evolution_api.get_connection_state(channel.instance_name)
    except evolution_api.EvolutionAPIError as e:
        # Si Evolution API dice que la instancia no existe, devolvemos disconnected
        # en lugar de propagar el error al frontend.
        if e.status_code in (404, 400):
            channel.connection_status = "disconnected"
            db.commit()
            return {
                "instance_name": channel.instance_name,
                "state": "close",
                "connection_status": "disconnected",
            }
        raise HTTPException(status_code=e.status_code, detail=e.message)

    state = result.get("state", "unknown")

    if state == "open":
        channel.connection_status = "connected"
    elif state in ("close", "closed"):
        channel.connection_status = "disconnected"
    else:
        channel.connection_status = state
    db.commit()

    return {
        "instance_name": channel.instance_name,
        "state": state,
        "connection_status": channel.connection_status,
    }


@router.post("/disconnect")
async def disconnect_whatsapp(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Desconecta WhatsApp (cierra sesión pero mantiene la configuración)."""
    channel = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    if not channel or not channel.instance_name:
        raise HTTPException(status_code=404, detail="WhatsApp no configurado")

    try:
        await evolution_api.logout_instance(channel.instance_name)
    except evolution_api.EvolutionAPIError:
        pass

    channel.connection_status = "disconnected"
    db.commit()

    return {"status": "disconnected"}


@router.delete("/remove")
async def remove_whatsapp(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina completamente la integración WhatsApp de la tienda."""
    channel = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    if not channel:
        raise HTTPException(status_code=404, detail="WhatsApp no configurado")

    if channel.instance_name:
        try:
            await evolution_api.delete_instance(channel.instance_name)
        except evolution_api.EvolutionAPIError:
            pass

    db.delete(channel)
    db.commit()

    return {"status": "removed"}


@router.post("/restart")
async def restart_whatsapp(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Reinicia la instancia de WhatsApp."""
    channel = db.query(AIChannel).filter(
        AIChannel.store_id == store.id,
        AIChannel.channel_type == "whatsapp",
    ).first()

    if not channel or not channel.instance_name:
        raise HTTPException(status_code=404, detail="WhatsApp no configurado")

    try:
        await evolution_api.restart_instance(channel.instance_name)
    except evolution_api.EvolutionAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    return {"status": "restarting"}
