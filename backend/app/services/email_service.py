"""
Email transaccional via Resend.

Centraliza el envío de emails para:
  - Invitaciones de equipo (Sesión 2B)
  - Notificación de chat asignado al vendedor (Sesión 3)
  - Otros emails transaccionales que sumemos en el futuro

Si la API key no está configurada, el servicio loggea pero no rompe — el
sistema sigue funcionando sin emails, lo cual es útil en desarrollo o
si se desconfigura accidentalmente en producción.
"""

import logging
from typing import Any

from app.config import get_dynamic_setting

logger = logging.getLogger(__name__)


# Remitente por defecto. Se puede sobrescribir desde platform_settings.
DEFAULT_FROM = "Agentro <hola@getagentro.com>"


def _get_resend():
    """
    Importa y configura el SDK de Resend con la API key dinámica.
    Devuelve None si la key no está configurada o el SDK no está instalado.
    """
    api_key = get_dynamic_setting("resend_api_key")
    if not api_key:
        logger.warning("[email] resend_api_key not configured; email skipped")
        return None
    try:
        import resend  # type: ignore
    except ImportError:
        logger.error("[email] resend SDK not installed (pip install resend)")
        return None
    resend.api_key = api_key
    return resend


def _get_from_address() -> str:
    """Permite override del remitente desde platform_settings."""
    custom = get_dynamic_setting("email_from_address")
    return custom or DEFAULT_FROM


def _send(payload: dict[str, Any]) -> bool:
    """Envío genérico. Loggea + retorna True/False sin levantar excepción."""
    resend = _get_resend()
    if not resend:
        return False
    try:
        result = resend.Emails.send(payload)
        logger.info(f"[email] sent to={payload.get('to')} subject={payload.get('subject')} id={getattr(result, 'id', None)}")
        return True
    except Exception as exc:
        logger.error(f"[email] send failed to={payload.get('to')}: {exc}", exc_info=True)
        return False


# ════════════════════════════════════════════════════════════════════
#  Templates de email
# ════════════════════════════════════════════════════════════════════

def _render_invitation_html(
    *,
    store_name: str,
    inviter_name: str,
    role: str,
    accept_url: str,
) -> str:
    """HTML simple para la invitación de equipo. Mobile-friendly."""
    role_label = {
        "seller": "Vendedor/a",
        "manager": "Gerente",
        "support": "Soporte",
    }.get(role, role.capitalize())

    return f"""<!doctype html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0F172A; color: #F8FAFC; margin: 0; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background: #1E293B; border-radius: 16px; padding: 32px; border: 1px solid rgba(255,255,255,0.08);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #6366F1, #8B5CF6);"></div>
    </div>
    <h1 style="font-size: 22px; margin: 0 0 16px; font-weight: 600;">
      Te invitaron a {store_name}
    </h1>
    <p style="font-size: 15px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px;">
      Hola 👋
    </p>
    <p style="font-size: 15px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px;">
      <strong style="color: #F8FAFC;">{inviter_name}</strong> te invitó a unirte a
      <strong style="color: #F8FAFC;">{store_name}</strong> en Agentro como
      <strong style="color: #6366F1;">{role_label}</strong>.
    </p>
    <p style="font-size: 15px; line-height: 1.6; color: #CBD5E1; margin: 0 0 24px;">
      Hacé click en el botón para crear tu cuenta y empezar a trabajar.
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="{accept_url}" style="display: inline-block; background: linear-gradient(135deg, #6366F1, #8B5CF6); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 100px; font-weight: 600; font-size: 15px;">
        Aceptar invitación
      </a>
    </div>
    <p style="font-size: 13px; color: #64748B; margin: 24px 0 0; text-align: center;">
      El link vence en 7 días. Si no esperabas esta invitación, podés ignorar este email.
    </p>
    <p style="font-size: 12px; color: #475569; margin: 16px 0 0; text-align: center; word-break: break-all;">
      O copiá este link: <br/>{accept_url}
    </p>
  </div>
  <p style="text-align: center; font-size: 12px; color: #475569; margin-top: 16px;">
    Agentro · IA de pre-venta para tu negocio
  </p>
</body>
</html>"""


def send_team_invitation(
    *,
    to_email: str,
    store_name: str,
    inviter_name: str,
    role: str,
    accept_url: str,
) -> bool:
    """Envía email de invitación al equipo. Retorna True si fue enviado."""
    role_label = {
        "seller": "vendedor",
        "manager": "gerente",
        "support": "soporte",
    }.get(role, role)

    return _send({
        "from": _get_from_address(),
        "to": to_email,
        "subject": f"{inviter_name} te invita a {store_name} como {role_label}",
        "html": _render_invitation_html(
            store_name=store_name,
            inviter_name=inviter_name,
            role=role,
            accept_url=accept_url,
        ),
    })


def send_chat_assignment_notification(
    *,
    to_email: str,
    seller_name: str,
    store_name: str,
    customer_name: str,
    handoff_priority: str,
    chat_url: str,
    summary_preview: str = "",
) -> bool:
    """
    Envía email cuando se asigna un chat a un vendedor.
    (Implementación inicial — se completa en Sesión 3 con WhatsApp y push.)
    """
    priority_label = {
        "vip": "🔥 VIP",
        "alta": "🟠 Alta",
        "media": "🟡 Media",
        "baja": "🟢 Baja",
    }.get(handoff_priority, handoff_priority)

    html = f"""<!doctype html>
<html>
<body style="font-family: -apple-system, sans-serif; background: #0F172A; color: #F8FAFC; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background: #1E293B; border-radius: 16px; padding: 28px; border: 1px solid rgba(255,255,255,0.08);">
    <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
      Nueva asignación · {priority_label}
    </div>
    <h1 style="font-size: 20px; margin: 0 0 8px;">
      Te asignaron un chat de {customer_name}
    </h1>
    <p style="font-size: 14px; color: #CBD5E1; margin: 0 0 20px;">
      Hola {seller_name}, el agente terminó la pre-venta y la conversación está lista para que vos la cierres.
    </p>
    {f'<div style="background: rgba(99,102,241,0.1); border-left: 3px solid #6366F1; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #CBD5E1;">{summary_preview}</div>' if summary_preview else ''}
    <div style="text-align: center; margin: 24px 0;">
      <a href="{chat_url}" style="display: inline-block; background: #6366F1; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 100px; font-weight: 600;">
        Abrir conversación
      </a>
    </div>
    <p style="font-size: 12px; color: #64748B; text-align: center;">{store_name} · Agentro</p>
  </div>
</body>
</html>"""

    return _send({
        "from": _get_from_address(),
        "to": to_email,
        "subject": f"Nueva asignación: {customer_name} ({priority_label}) — {store_name}",
        "html": html,
    })
