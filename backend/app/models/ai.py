"""
Modelos de IA: conversaciones, canales, agentes.
Estructura preparada para WhatsApp, chat web, Instagram (futuro).
"""

from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class ChannelType(str, enum.Enum):
    """Tipos de canal de IA."""

    WEB_CHAT = "web_chat"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"  # Futuro


class Conversation(Base, UUIDMixin, TimestampMixin):
    """Conversación (hilo de mensajes con un cliente)."""

    __tablename__ = "conversations"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    channel_id = Column(String(36), ForeignKey("ai_channels.id", ondelete="CASCADE"), nullable=True)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    external_id = Column(String(255), nullable=True)  # ID en WhatsApp, etc.
    channel_type = Column(String(50), nullable=True)
    status = Column(String(50), default="active")

    # Relaciones
    channel = relationship("AIChannel", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    sales_session = relationship("SalesSession", back_populates="conversation", uselist=False)


class Message(Base, UUIDMixin, TimestampMixin):
    """Mensaje en una conversación."""

    __tablename__ = "messages"

    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)

    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    extra_metadata = Column("metadata", Text, nullable=True)  # JSON adicional (columna "metadata" en DB)

    # Relación
    conversation = relationship("Conversation", back_populates="messages")


class AIChannel(Base, UUIDMixin, TimestampMixin):
    """Canal de IA (WhatsApp, web chat, etc.)."""

    __tablename__ = "ai_channels"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(String(36), ForeignKey("ai_agents.id", ondelete="SET NULL"), nullable=True)

    channel_type = Column(String(50), nullable=False)  # web_chat, whatsapp, instagram
    is_active = Column(Boolean, default=True)
    config = Column(Text, nullable=True)  # JSON con credenciales/config

    # Evolution API / WhatsApp fields
    instance_name = Column(String(255), nullable=True, unique=True)
    instance_token = Column(String(512), nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    whatsapp_number = Column(String(50), nullable=True)
    connection_status = Column(String(50), nullable=True, default="disconnected")

    # Relaciones
    agent = relationship("AIAgent", back_populates="channels")
    conversations = relationship("Conversation", back_populates="channel", foreign_keys="Conversation.channel_id")


class AIAgent(Base, UUIDMixin, TimestampMixin):
    """Agente de IA (asistente de ventas, lead detection, etc.)."""

    __tablename__ = "ai_agents"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    config = Column(Text, nullable=True)  # JSON: model, temperature, etc.
    is_active = Column(Boolean, default=True)

    # Stage agent fields
    agent_type = Column(String(50), default="generic")  # generic | stage
    stage_name = Column(String(50), nullable=True)  # incoming, discovery, recommendation, ...
    display_name = Column(String(255), nullable=True)
    tone = Column(String(50), nullable=True)  # friendly, professional, casual
    language = Column(String(10), nullable=True, default="es")
    sales_style = Column(String(50), nullable=True)  # consultative, aggressive, soft
    enabled_tools = Column(Text, nullable=True)  # JSON list: ["product_search", ...]

    # Relaciones
    channels = relationship("AIChannel", back_populates="agent")
