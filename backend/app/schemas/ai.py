"""
Schemas de IA - conversaciones, agentes, canales.
"""

from pydantic import BaseModel


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    store_id: str
    channel_id: str | None
    customer_id: str | None
    channel_type: str | None
    status: str

    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    id: str
    store_id: str
    channel_id: str | None
    customer_id: str | None
    channel_type: str | None
    status: str
    messages: list[MessageResponse] = []
    customer_name: str | None = None
    customer_email: str | None = None
    session_id: str | None = None
    current_stage: str | None = None

    class Config:
        from_attributes = True


class AIAgentCreate(BaseModel):
    name: str
    description: str | None = None
    system_prompt: str | None = None
    config: str | None = None
    is_active: bool = True
    agent_type: str = "generic"
    stage_name: str | None = None
    display_name: str | None = None
    tone: str | None = None
    language: str | None = "es"
    sales_style: str | None = None
    enabled_tools: str | None = None


class AIAgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    config: str | None = None
    is_active: bool | None = None
    agent_type: str | None = None
    stage_name: str | None = None
    display_name: str | None = None
    tone: str | None = None
    language: str | None = None
    sales_style: str | None = None
    enabled_tools: str | None = None


class AIAgentResponse(BaseModel):
    id: str
    store_id: str
    name: str
    description: str | None
    system_prompt: str | None
    is_active: bool
    agent_type: str | None = "generic"
    stage_name: str | None = None
    display_name: str | None = None
    tone: str | None = None
    language: str | None = None
    sales_style: str | None = None
    enabled_tools: str | None = None
    config: str | None = None

    class Config:
        from_attributes = True


class AIChannelCreate(BaseModel):
    channel_type: str  # web_chat, whatsapp, instagram
    agent_id: str | None = None
    config: str | None = None
    is_active: bool = True


class AIChannelResponse(BaseModel):
    id: str
    store_id: str
    agent_id: str | None
    channel_type: str
    is_active: bool

    class Config:
        from_attributes = True
