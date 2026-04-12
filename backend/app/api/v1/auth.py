"""
Endpoints de autenticación.
Login, registro, JWT, refresh, Google OAuth.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.db.session import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    TokenResponse,
    UserResponse,
    AuthMeResponse,
    RefreshTokenRequest,
)
from app.services.onboarding_service import get_auth_state
from app.services.audit_service import log_action, get_client_info
from app.services.auth_service import get_google_auth_url, exchange_google_code_for_user
from app.config import get_settings
from app.utils.logging import get_logger
import httpx

router = APIRouter()
logger = get_logger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)
settings = get_settings()


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Obtiene usuario actual si hay token válido. Retorna None si no autenticado."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user if user and user.is_active else None


def get_current_user(
    user: User | None = Depends(get_current_user_optional),
) -> User:
    """Obtiene usuario actual. Lanza 401 si no autenticado."""
    if user is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    return user


@router.post("/register", response_model=TokenResponse)
def register(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """Registro de nuevo usuario."""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email ya registrado")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        auth_provider="email",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "user.register", user_id=user.id, details={"email": user.email},
        ip_address=ip, user_agent=user_agent
    )

    access_token = create_access_token(subject=user.id, extra_claims={"email": user.email})
    refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Login con email y contraseña."""
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario desactivado")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    ip, user_agent = get_client_info(request)
    log_action(
        db, "user.login", user_id=user.id, details={"email": user.email},
        ip_address=ip, user_agent=user_agent
    )

    access_token = create_access_token(subject=user.id, extra_claims={"email": user.email})
    refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Renueva access token usando refresh token."""
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh token inválido")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no válido")

    access_token = create_access_token(subject=user.id, extra_claims={"email": user.email})
    new_refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=AuthMeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Obtiene usuario actual autenticado con estado de onboarding."""
    return get_auth_state(db, user)


@router.get("/google")
def google_login(state: str | None = None):
    """
    Inicia flujo OAuth de Google.
    Redirige al usuario a Google para autenticación.
    Requiere GOOGLE_CLIENT_ID configurado (en .env o panel admin).
    """
    from app.config import get_dynamic_setting
    from fastapi.responses import RedirectResponse

    client_id = get_dynamic_setting("google_client_id")
    if not client_id:
        return RedirectResponse(
            url=f"{settings.frontend_url}/login?error=google_not_configured"
        )
    url = get_google_auth_url(state=state)
    return RedirectResponse(url=url)


VALID_OAUTH_STATES = {"app", "onboarding", "login"}


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Callback de Google OAuth.
    Intercambia code por tokens, crea/actualiza usuario, devuelve tokens.
    Redirige al frontend con tokens en fragment (#) para seguridad (no se envía al servidor).
    Valida state como hint de redirección (app, onboarding, login).
    """
    if error:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=oauth_failed")
    if not code:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=oauth_failed")

    # Validar state: debe ser un valor conocido (CSRF simple)
    safe_state = state if state and state in VALID_OAUTH_STATES else "app"

    try:
        user = await exchange_google_code_for_user(db, code)
    except ValueError as e:
        logger.warning("OAuth callback ValueError: %s", str(e))
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=oauth_failed")
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.warning("OAuth token exchange failed: %s", str(e))
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{settings.frontend_url}/login?error=oauth_token_failed")

    ip, user_agent = get_client_info(request)
    log_action(
        db, "user.login", user_id=user.id, details={"provider": "google", "email": user.email},
        ip_address=ip, user_agent=user_agent
    )

    access_token = create_access_token(subject=user.id, extra_claims={"email": user.email})
    refresh_token = create_refresh_token(subject=user.id)

    from urllib.parse import urlencode
    from fastapi.responses import RedirectResponse
    fragment = urlencode({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "state": safe_state,
    })
    redirect_url = f"{settings.frontend_url}/auth/callback#{fragment}"
    return RedirectResponse(url=redirect_url)
