"""
Modelo AgentFlow — diagrama de flujo custom para el agente (Enterprise tier).

Permite definir visualmente el comportamiento del agente: qué hace ante cada
trigger, qué condiciones evaluar, qué mensajes mandar, cuándo escalar a humano,
etc. Se renderiza en frontend con react-flow (drag-and-drop).

Estructura compatible con react-flow:
  nodes = [
    { id, type, position: {x,y}, data: {...} }
  ]
  edges = [
    { id, source, target, sourceHandle?, targetHandle?, label?, data?: {...} }
  ]

Tipos de nodos soportados (definidos en agent_flow_executor):
  - trigger: punto de entrada (mensaje recibido, evento)
  - condition: branch lógico (if/else)
  - message: enviar mensaje al cliente
  - tool_call: ejecutar una tool (check_availability, etc.)
  - escalate: escalar a vendedor humano (handoff)
  - collect_data: pedir un dato específico al cliente
  - delay: esperar X segundos antes de continuar

Solo UN AgentFlow puede estar `is_active=True` por store a la vez. Cuando hay
flow activo, el `agent_runtime` lo ejecuta en vez del comportamiento default.
"""

import json

from sqlalchemy import Column, String, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.db.base import UUIDMixin, TimestampMixin


class AgentFlow(Base, UUIDMixin, TimestampMixin):
    """Diagrama de flujo custom del agente."""

    __tablename__ = "agent_flows"

    store_id = Column(
        String(36),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Nodos y edges en formato JSON (compatible con react-flow)
    nodes = Column(Text, nullable=False, default="[]")
    edges = Column(Text, nullable=False, default="[]")

    # Solo un flow activo por store. Cuando is_active=True, el agent_runtime
    # ejecuta este flow en vez del comportamiento default.
    is_active = Column(Boolean, nullable=False, default=False, index=True)

    # Versioning — cada save crea un snapshot. parent_flow_id apunta a la
    # versión anterior. La última versión (sin children) es la actual.
    version = Column(Integer, nullable=False, default=1)
    parent_flow_id = Column(
        String(36),
        ForeignKey("agent_flows.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relación
    store = relationship("Store")

    # ── Helpers de parseo ──────────────────────────────────────────

    def nodes_list(self) -> list[dict]:
        try:
            return json.loads(self.nodes or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    def edges_list(self) -> list[dict]:
        try:
            return json.loads(self.edges or "[]")
        except (json.JSONDecodeError, TypeError):
            return []
