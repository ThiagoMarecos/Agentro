"""
Servicio de autenticación.
Incluye Google OAuth.
"""

from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings, get_dynamic_setting
from app.models.user import User
from app.core.security import get_password_hash, create_access_token, create_refresh_token

settings = get_settings()


def _google_client_id() -> str:
    return get_dynamic_setting("google_client_id")

def _google_client_secret() -> str:
    return get_dynamic_setting("google_client_secret")

def _google_redirect_uri() -> str:
    val = get_dynamic_setting("google_redirect_uri")
    return val or f"{settings.backend_url.rstrip('/')}{settings.api_prefix}/auth/google/callback"


def get_google_auth_url(state: str | None = None) -> str:
    """Genera URL para iniciar flujo OAuth de Google."""
    client_id = _google_client_id()
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID no configurado")
    params = {
        "client_id": client_id,
        "redirect_uri": _google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    if state:
        params["state"] = state
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"


async def exchange_google_code_for_user(db: Session, code: str) -> User:
    """
    Intercambia code de Google por tokens, obtiene datos del usuario,
    crea o actualiza User y lo retorna.
    """
    client_id = _google_client_id()
    client_secret = _google_client_secret()
    if not client_id or not client_secret:
        raise ValueError("Google OAuth no configurado")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _google_redirect_uri(),
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_resp.raise_for_status()
        tokens = token_resp.json()

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()

    google_id = userinfo.get("id")
    email = userinfo.get("email")
    name = userinfo.get("name")
    picture = userinfo.get("picture")

    if not email:
        raise ValueError("Email no proporcionado por Google")

    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
            user.avatar_url = picture
            user.is_verified = True
            user.full_name = user.full_name or name or email
        else:
            user = User(
                email=email,
                full_name=name or email,
                google_id=google_id,
                avatar_url=picture,
                is_verified=True,
                auth_provider="google",
            )
            db.add(user)
    else:
        user.avatar_url = picture
        user.is_verified = True
        user.full_name = user.full_name or name or email

    user.auth_provider = "google"
    user.last_login_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user
