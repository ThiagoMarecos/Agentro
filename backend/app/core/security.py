"""
Seguridad: JWT, hashing de contraseñas, OAuth.

Hashing:
  - Usamos bcrypt directo (no passlib) porque bcrypt 4.x agregó una
    validación estricta de 72 bytes que rompe el flujo de passlib 1.7.4.
  - El hash producido es 100% compatible con el formato que generaba
    passlib ($2b$...), así que los usuarios viejos siguen autenticando.
"""

from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

# Límite hardcodeado de bcrypt: 72 bytes. Cortamos a 72 BYTES (no chars).
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    """Codifica a UTF-8 y trunca a 72 bytes (límite hardcodeado de bcrypt)."""
    if not isinstance(password, str):
        raise TypeError("password debe ser str")
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica contraseña contra hash. Robusto a hashes vacíos / corruptos."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            _to_bcrypt_bytes(plain_password),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def get_password_hash(password: str) -> str:
    """Genera hash bcrypt de la contraseña (formato $2b$...)."""
    hashed = bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    """Crea JWT access token."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)

    expire = datetime.utcnow() + expires_delta
    to_encode = {"sub": subject, "exp": expire, "type": "access"}
    if extra_claims:
        to_encode.update(extra_claims)

    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    """Crea JWT refresh token."""
    expire = datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days)
    to_encode = {"sub": subject, "exp": expire, "type": "refresh"}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    """Decodifica y valida JWT. Retorna payload o None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None
