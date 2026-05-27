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


# ════════════════════════════════════════════════════════════════════
#  Invitation requests (formulario público de pedir invitación a la beta)
# ════════════════════════════════════════════════════════════════════

def send_invitation_request_confirmation(
    *, to_email: str, full_name: str, business_name: str
) -> bool:
    """Email de confirmación al solicitante después de llenar el formulario."""
    first_name = (full_name or "").split()[0] if full_name else ""
    greeting = f"Hola{', ' + first_name if first_name else ''}!"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#05060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:48px 32px;">
    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://getagentro.com/agentro-white.png" alt="Agentro" height="32" style="height:32px;width:auto;display:inline-block;" />
    </div>

    <div style="background:rgba(10,11,26,0.78);border:1px solid rgba(255,255,255,0.18);border-radius:22px;padding:36px 32px;">
      <h1 style="font-size:24px;font-weight:600;margin:0 0 16px 0;letter-spacing:-0.02em;line-height:1.25;">{greeting}</h1>

      <p style="font-size:15px;line-height:1.6;color:#9ba0c0;margin:0 0 18px 0;">
        Recibimos tu pedido de invitación para <strong style="color:#fff;">{business_name}</strong>. Te confirmamos que ya está en nuestra lista.
      </p>
      <p style="font-size:15px;line-height:1.6;color:#9ba0c0;margin:0 0 18px 0;">
        En las próximas <strong style="color:#fff;">24 horas</strong> te respondemos por este mismo mail con uno de estos dos caminos:
      </p>

      <ul style="font-size:14px;line-height:1.6;color:#9ba0c0;margin:0 0 24px 0;padding-left:20px;">
        <li style="margin-bottom:6px;">El link para entrar y armar tu tienda</li>
        <li>Algunas preguntas más sobre tu negocio (si necesitamos contexto)</li>
      </ul>

      <p style="font-size:14px;line-height:1.6;color:#9ba0c0;margin:0 0 24px 0;">
        Mientras tanto, si tenés algo para contarnos o una pregunta puntual, respondé este mismo mail y te leemos.
      </p>

      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;margin-top:24px;">
        <p style="font-size:12px;color:#5d6285;font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;text-transform:uppercase;margin:0;">
          Mientras tanto · Beta cerrada · Sin tarjeta · Sin compromiso
        </p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:12px;color:#5d6285;margin:0;">
        Agentro · La IA vende. Vos cerrás.<br>
        <a href="https://getagentro.com" style="color:#b39bff;text-decoration:none;">getagentro.com</a>
      </p>
    </div>
  </div>
</body>
</html>"""

    return _send({
        "from": _get_from_address(),
        "to": to_email,
        "subject": "Recibimos tu pedido — Agentro",
        "html": html,
    })


def send_invitation_request_admin_notification(req) -> bool:
    """
    Email al admin avisando que hay un nuevo pedido de invitación.
    El destinatario es el dueño del producto (vos). Por ahora lo mandamos
    a un email configurable; si no está seteado, no se envía nada.
    """
    admin_email = get_dynamic_setting("admin_notification_email") or get_dynamic_setting("email_from_address")
    if not admin_email:
        logger.info("[email] admin_notification_email no configurado — skip notificacion admin")
        return False

    # Si email_from_address tiene formato 'Nombre <correo@dom.com>', extraer solo el correo
    import re
    m = re.search(r"<([^>]+)>", admin_email)
    if m:
        admin_email = m.group(1)

    referral_label = {
        "google": "Google",
        "ai": "Sugerencia de IA (ChatGPT/Claude/etc)",
        "recommendation": "Recomendación de alguien",
        "social": "Redes sociales",
        "ad": "Publicidad",
        "press": "Prensa / blog",
        "event": "Evento",
        "other": "Otro",
    }.get(req.referral_source or "", req.referral_source or "—")

    biz_label = {
        "retail": "Retail / Moda",
        "gastro": "Gastronomía",
        "services": "Servicios",
        "ecommerce": "E-commerce",
        "other": "Otro",
    }.get(req.business_type, req.business_type)

    expectations_block = (
        f'<p style="font-size:13px;color:#9ba0c0;margin:8px 0 0 0;line-height:1.5;"><em>"{req.expectations}"</em></p>'
        if req.expectations else ""
    )
    referral_detail_block = (
        f'<div style="font-size:12px;color:#9ba0c0;margin-top:4px;">Detalle: {req.referral_detail}</div>'
        if req.referral_detail else ""
    )

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#05060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="https://getagentro.com/agentro-white.png" alt="Agentro" height="28" style="height:28px;width:auto;display:inline-block;" />
    </div>
    <h2 style="font-size:18px;margin:0 0 8px 0;letter-spacing:-0.01em;">📥 Nuevo pedido de invitación</h2>
    <p style="font-size:13px;color:#9ba0c0;margin:0 0 24px 0;">Acaba de llegar una nueva solicitud al formulario de la landing.</p>

    <div style="background:rgba(10,11,26,0.78);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:24px;">
      <table style="width:100%;font-size:14px;color:#fff;">
        <tr><td style="padding:6px 0;color:#5d6285;width:140px;">Nombre</td><td style="padding:6px 0;"><strong>{req.full_name}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#5d6285;">Email</td><td style="padding:6px 0;"><a href="mailto:{req.email}" style="color:#b39bff;">{req.email}</a></td></tr>
        <tr><td style="padding:6px 0;color:#5d6285;">Negocio</td><td style="padding:6px 0;"><strong>{req.business_name}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#5d6285;">Tipo</td><td style="padding:6px 0;">{biz_label}</td></tr>
        {f'<tr><td style="padding:6px 0;color:#5d6285;">WhatsApp</td><td style="padding:6px 0;">{req.whatsapp}</td></tr>' if req.whatsapp else ''}
        {f'<tr><td style="padding:6px 0;color:#5d6285;">País</td><td style="padding:6px 0;">{req.country}</td></tr>' if req.country else ''}
        <tr><td style="padding:6px 0;color:#5d6285;">Cómo llegó</td><td style="padding:6px 0;">{referral_label}{referral_detail_block}</td></tr>
      </table>

      {f'<div style="margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.08);"><div style="font-size:11px;color:#5d6285;text-transform:uppercase;letter-spacing:0.08em;font-family:JetBrains Mono,monospace;">Qué espera</div>{expectations_block}</div>' if req.expectations else ''}
    </div>

    <p style="margin-top:24px;font-size:12px;color:#5d6285;">
      Para responder, escribile a <a href="mailto:{req.email}" style="color:#b39bff;">{req.email}</a>.<br>
      También podés gestionarlo desde el panel super admin → Invitaciones.
    </p>
  </div>
</body>
</html>"""

    return _send({
        "from": _get_from_address(),
        "to": admin_email,
        "subject": f"📥 Nuevo pedido de invitación · {req.full_name} · {req.business_name}",
        "html": html,
    })
