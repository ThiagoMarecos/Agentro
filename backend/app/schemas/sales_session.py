"""
Schemas de sesiones de venta y pipeline.
"""

from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class NotebookSection(BaseModel):
    customer: dict[str, Any] = {}
    intent: dict[str, Any] = {}
    interest: dict[str, Any] = {}
    recommendation: dict[str, Any] = {}
    pricing: dict[str, Any] = {}
    availability: dict[str, Any] = {}
    shipping: dict[str, Any] = {}
    payment: dict[str, Any] = {}
    order: dict[str, Any] = {}
    agent_control: dict[str, Any] = {}


class SalesSessionResponse(BaseModel):
    id: str
    store_id: str
    agent_id: str | None
    conversation_id: str
    customer_id: str | None
    channel_id: str | None
    current_stage: str
    status: str
    estimated_value: Decimal | None
    currency: str
    priority: str
    blocker_reason: str | None
    last_agent_action: str | None
    next_expected_action: str | None
    follow_up_count: int
    owner_notified: bool
    requires_manual_review: bool
    started_at: str | None
    stage_entered_at: str | None
    closed_at: str | None
    notebook: NotebookSection | None = None

    class Config:
        from_attributes = True


class SalesSessionUpdate(BaseModel):
    priority: str | None = None
    requires_manual_review: bool | None = None
    owner_notified: bool | None = None
    blocker_reason: str | None = None


class SalesSessionListItem(BaseModel):
    id: str
    current_stage: str
    status: str
    estimated_value: Decimal | None
    currency: str
    priority: str
    customer_email: str | None = None
    customer_name: str | None = None
    last_agent_action: str | None
    follow_up_count: int
    started_at: str | None
    stage_entered_at: str | None


class PipelineStage(BaseModel):
    stage: str
    count: int
    sessions: list[SalesSessionListItem]


class PipelineResponse(BaseModel):
    stages: list[PipelineStage]
    total: int
