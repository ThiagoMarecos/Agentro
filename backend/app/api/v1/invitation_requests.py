"""
Endpoint público para que cualquier visitante de la landing pida una
invitación a la beta cerrada. También endpoints admin para listar y
gestionar las solicitudes.
"""

import logging
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.dependencies import require_superadmin
from app.db.session import get_db
from app.models.invitation_request import InvitationRequest, VALID_STATUSES, STATUS_PENDING
from app.models.user import User
from app.schemas.invitation_request import (
    InvitationRequestAdminItem,
    InvitationRequestCreate,
    InvitationRequestPublicResponse,
    InvitationRequestUpdate,
)
from app.services.audit_service import log_action

logger = logging.getLogger(__name__)
router = APIRouter()

# ════════════════════════════════════════════════════════════════════
#  Anti-spam: rate limit en memoria por IP (no por usuario, es público)
#  Máximo 3 requests por IP cada 10 minutos. Suficiente para uso real,
#  bloquea bots básicos. Para algo más serio usar Redis.
# ════════════════════════════════════════════════════════════════════

_RATE_WINDOW_SECONDS = 600  # 10 min
_RATE_MAX_REQUESTS = 3
_rate_log: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(ip: str) -> bool:
    """True si la IP puede hacer la request, False si excede el límite."""
    now = time.time()
    q = _rate_log[ip]
    # Purgar entries fuera de la ventana
    while q and (now - q[0]) > _RATE_WINDOW_SECONDS:
        q.popleft()
    if len(q) >= _RATE_MAX_REQUESTS:
        return False
    q.append(now)
    return True


def _client_ip(request: Request) -> str:
    """Saca la IP real considerando reverse-proxies (nginx)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ════════════════════════════════════════════════════════════════════
#  PUBLIC — formulario de pedir invitación
# ════════════════════════════════════════════════════════════════════

@router.post(
    "/invitation-requests",
    response_model=InvitationRequestPublicResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation_request(
    payload: InvitationRequestCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint PÚBLICO. Crea una solicitud de invitación a la beta.
    Lo llama el formulario en /request-invite de la landing.

    Anti-spam: rate-limited a 3 requests / 10 min por IP.
    """
    ip = _client_ip(request)
    if not _check_rate_limit(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas solicitudes. Esperá unos minutos.",
        )

    # Anti-duplicado: si la misma persona pide dos veces en menos de 24h, decirle gentil.
    existing = (
        db.query(InvitationRequest)
        .filter(InvitationRequest.email == str(payload.email).lower())
        .order_by(desc(InvitationRequest.created_at))
        .first()
    )
    if existing:
        # No es error — solo le decimos al user que ya está procesado.
        logger.info(
            f"[invite-request] email duplicado {payload.email} — devolvemos id existente"
        )
        return InvitationRequestPublicResponse(
            received=True,
            message=(
                "Ya teníamos tu pedido registrado. Te estamos por escribir desde "
                "Agentro — revisá tu casilla (y la carpeta de spam por si acaso)."
            ),
            request_id=existing.id,
        )

    ua = request.headers.get("user-agent", "")[:500] or None

    req = InvitationRequest(
        email=str(payload.email).lower(),
        full_name=payload.full_name,
        business_name=payload.business_name,
        business_type=payload.business_type,
        whatsapp=payload.whatsapp,
        country=payload.country,
        referral_source=payload.referral_source,
        referral_detail=payload.referral_detail,
        expectations=payload.expectations,
        accepts_contact=payload.accepts_contact,
        ip_address=ip,
        user_agent=ua,
        status=STATUS_PENDING,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    log_action(
        db,
        "invitation_request.created",
        resource_type="invitation_request",
        resource_id=req.id,
        details={"email": req.email, "business_name": req.business_name, "source": req.referral_source},
        ip_address=ip,
        user_agent=ua,
    )

    # Disparar emails (notificar al admin + confirmar al user). No bloqueamos
    # si falla — el pedido ya está guardado en DB.
    try:
        from app.services.email_service import (
            send_invitation_request_confirmation,
            send_invitation_request_admin_notification,
        )
        send_invitation_request_confirmation(
            to_email=req.email,
            full_name=req.full_name,
            business_name=req.business_name,
        )
        send_invitation_request_admin_notification(req)
    except Exception as exc:
        logger.warning(f"[invite-request] email notification failed: {exc}")

    return InvitationRequestPublicResponse(
        received=True,
        message="Recibimos tu pedido. Te respondemos por mail en 24hs.",
        request_id=req.id,
    )


# ════════════════════════════════════════════════════════════════════
#  ADMIN — listar / actualizar solicitudes (requiere superadmin)
# ════════════════════════════════════════════════════════════════════

@router.get("/admin/invitation-requests", response_model=list[InvitationRequestAdminItem])
def list_invitation_requests_admin(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_superadmin),
    status_filter: Optional[str] = None,
    limit: int = 100,
):
    """Lista las solicitudes para el panel super admin."""
    q = db.query(InvitationRequest).order_by(desc(InvitationRequest.created_at))
    if status_filter and status_filter in VALID_STATUSES:
        q = q.filter(InvitationRequest.status == status_filter)
    return q.limit(min(limit, 500)).all()


@router.patch("/admin/invitation-requests/{request_id}", response_model=InvitationRequestAdminItem)
def update_invitation_request_admin(
    request_id: str,
    payload: InvitationRequestUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_superadmin),
):
    """
    Update de status + notes (solo superadmin).
    Si el status cambia a 'approved' o 'rejected', dispara email automático al user.
    """
    req = db.query(InvitationRequest).filter(InvitationRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Solicitud no encontrada")

    changes = {}
    status_transition: Optional[str] = None  # 'approved' | 'rejected' si cambio
    if payload.status is not None and payload.status in VALID_STATUSES:
        if payload.status != req.status:
            changes["status"] = {"from": req.status, "to": payload.status}
            previous_status = req.status
            req.status = payload.status
            if payload.status == "approved" and not req.approved_at:
                from datetime import datetime, timezone
                req.approved_at = datetime.now(timezone.utc)
                req.approved_by_user_id = admin.id
            # Solo notificar la PRIMERA vez que se aprueba o rechaza,
            # no en idas y vueltas (ej: rejected → pending → rejected de nuevo).
            if payload.status == "approved" and previous_status != "approved":
                status_transition = "approved"
            elif payload.status == "rejected" and previous_status != "rejected":
                status_transition = "rejected"

    if payload.notes is not None:
        req.notes = payload.notes
        changes["notes_updated"] = True

    if changes:
        db.add(req)
        db.commit()
        db.refresh(req)
        log_action(
            db,
            "invitation_request.updated",
            user_id=admin.id,
            resource_type="invitation_request",
            resource_id=req.id,
            details=changes,
        )

        # Dispara email al user si hubo transicion de status relevante.
        # No bloqueamos el response si el email falla.
        if status_transition:
            try:
                from app.services.email_service import (
                    send_invitation_request_approved,
                    send_invitation_request_rejected,
                )
                if status_transition == "approved":
                    send_invitation_request_approved(req)
                    logger.info(f"[invite-request] email aprobacion enviado a {req.email}")
                elif status_transition == "rejected":
                    send_invitation_request_rejected(req)
                    logger.info(f"[invite-request] email rechazo enviado a {req.email}")
            except Exception as exc:
                logger.warning(f"[invite-request] no se pudo enviar email de {status_transition}: {exc}")

    return req
