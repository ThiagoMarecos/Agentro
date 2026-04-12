"""
Modelo de sesión de venta autónoma.
Representa una venta en curso gestionada por agentes IA.
"""

import json
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, ForeignKey, Text, Boolean, Integer,
    Numeric, DateTime,
)
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


EMPTY_NOTEBOOK = {
    "customer": {"name": "", "email": "", "phone": "", "preferences": []},
    "intent": {"detected": "", "confidence": 0, "keywords": []},
    "interest": {"products_mentioned": [], "categories": [], "budget_range": ""},
    "recommendation": {"products": [], "reasoning": ""},
    "pricing": {"quoted": 0, "discounts": [], "total": 0},
    "availability": {"checked_products": [], "all_available": False},
    "shipping": {"address": "", "method": "", "estimated_cost": 0},
    "payment": {"method": "", "status": "", "link": "", "transaction_id": ""},
    "order": {"order_id": "", "items": [], "total": 0},
    "agent_control": {"current_agent": "", "last_action": "", "flags": []},
}


class SalesSession(Base, UUIDMixin, TimestampMixin):
    """Sesión de venta autónoma gestionada por agentes IA."""

    __tablename__ = "sales_sessions"

    store_id = Column(String(36), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(String(36), ForeignKey("ai_agents.id", ondelete="SET NULL"), nullable=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    channel_id = Column(String(36), ForeignKey("ai_channels.id", ondelete="SET NULL"), nullable=True)

    current_stage = Column(String(50), nullable=False, default="incoming")
    status = Column(String(50), nullable=False, default="active")

    estimated_value = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(3), default="USD")
    priority = Column(String(20), default="medium")

    blocker_reason = Column(Text, nullable=True)
    last_agent_action = Column(Text, nullable=True)
    next_expected_action = Column(Text, nullable=True)

    follow_up_count = Column(Integer, default=0)
    owner_notified = Column(Boolean, default=False)
    requires_manual_review = Column(Boolean, default=False)

    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    stage_entered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime(timezone=True), nullable=True)

    notebook = Column(Text, nullable=True, default=lambda: json.dumps(EMPTY_NOTEBOOK))

    # Relaciones
    conversation = relationship("Conversation", back_populates="sales_session")

    def get_notebook(self) -> dict:
        if not self.notebook:
            return dict(EMPTY_NOTEBOOK)
        try:
            return json.loads(self.notebook)
        except (json.JSONDecodeError, TypeError):
            return dict(EMPTY_NOTEBOOK)

    def set_notebook(self, data: dict) -> None:
        self.notebook = json.dumps(data, ensure_ascii=False)

    def update_notebook_section(self, section: str, data: dict) -> None:
        nb = self.get_notebook()
        if section in nb:
            nb[section].update(data)
        else:
            nb[section] = data
        self.set_notebook(nb)
