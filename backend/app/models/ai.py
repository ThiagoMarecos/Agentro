"""
Modelos de IA: conversaciones, canales, agentes.
Estructura preparada para WhatsApp, chat web, Instagram (futuro).
"""

from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Enum, Integer, Numeric, DateTime
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

    # ── Métricas para dashboard de rendimiento ──
    tool_calls_count = Column(Integer, default=0, nullable=True)
    total_tokens = Column(Integer, default=0, nullable=True)
    # outcome: sale_completed | dropped_off | escalated | abandoned | ongoing
    outcome = Column(String(50), nullable=True, default="ongoing")
    outcome_reason = Column(String(255), nullable=True)
    # Última etapa alcanzada (snapshot al cerrarse / abandonarse)
    last_stage_reached = Column(String(50), nullable=True)
    # Valor monetario estimado de la oportunidad
    estimated_value = Column(Numeric(12, 2), nullable=True)

    # ── Handoff a vendedor humano (FASE 5 del flujo) ──
    # Cuando el agente termina su pre-venta y escala. La asignación se hace
    # desde la UI de "bandeja sin asignar" o automáticamente en el futuro.
    agent_paused = Column(Boolean, nullable=True, default=False)  # vendedor "tomó control"
    needs_seller_assignment = Column(Boolean, nullable=True, default=False)  # esperando asignación
    assigned_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    handoff_summary = Column(Text, nullable=True)  # JSON con el resumen estructurado del agente

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

    # ── Modo aprendizaje ──
    # Cuando está activado, se inyectan al prompt las "lecciones" creadas por el dueño.
    learning_mode_enabled = Column(Boolean, default=False, nullable=True)

    # Relaciones
    channels = relationship("AIChannel", back_populates="agent")
    lessons = relationship("AgentLesson", back_populates="agent", cascade="all, delete-orphan")


class AgentLesson(Base, UUIDMixin, TimestampMixin):
    """
    Lecciones del modo aprendizaje.
    El dueño marca conversaciones con respuestas malas y crea lecciones.
    Cuando el agente está en modo aprendizaje, estas lecciones se inyectan al prompt.
    """

    __tablename__ = "agent_lessons"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(String(36), ForeignKey("ai_agents.id", ondelete="CASCADE"), nullable=False)
    # Origen opcional: la conversación que disparó esta lección
    source_conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True)

    title = Column(String(255), nullable=False)
    lesson_text = Column(Text, nullable=False)
    bad_response_example = Column(Text, nullable=True)
    correct_response = Column(Text, nullable=True)

    # Categorización para el dueño
    category = Column(String(50), nullable=True)  # tone, accuracy, flow, product_info, escalation
    is_active = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=5, nullable=True)  # 1=máxima, 10=baja

    # Relaciones
    agent = relationship("AIAgent", back_populates="lessons")
