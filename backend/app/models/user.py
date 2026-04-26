"""
Modelos de usuario y roles.
"""

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship
import enum

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class RoleEnum(str, enum.Enum):
    """Roles del sistema.

    Jerarquía (de mayor a menor poder):
      OWNER → ADMIN → MANAGER → SUPPORT / SELLER

    SELLER tiene un acceso PARALELO al de SUPPORT: comparte nivel jerárquico
    pero su jurisdicción es distinta — solo ve los chats que tiene asignados,
    no toda la tienda. Los endpoints de chats filtran por seller_id cuando
    el rol es SELLER.
    """

    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    SUPPORT = "support"
    SELLER = "seller"


class User(Base, UUIDMixin, TimestampMixin):
    """Usuario del sistema (propietario o miembro de tiendas)."""

    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)  # Null si solo OAuth
    full_name = Column(String(255), nullable=True)
    # Teléfono (E.164 sin '+', ej. 5491156789012). Opcional. Usado para
    # notificaciones WhatsApp internas cuando se asigna un chat al vendedor.
    phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superadmin = Column(Boolean, default=False)

    # OAuth
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    avatar_url = Column(String(512), nullable=True)
    auth_provider = Column(String(50), default="email")  # email | google
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Relaciones
    store_memberships = relationship("StoreMember", back_populates="user", cascade="all, delete-orphan")


class Role(Base, UUIDMixin, TimestampMixin):
    """Roles disponibles (tabla de referencia)."""

    __tablename__ = "roles"

    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
