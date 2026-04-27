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
    # Sesión 2B + 3 — sistema de equipo / handoff
    agent_paused: bool | None = None
    needs_seller_assignment: bool | None = None
    assigned_user_id: str | None = None
    assigned_at: str | None = None
    handoff_summary: str | None = None  # JSON serializado del resumen del agente

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
    learning_mode_enabled: bool | None = False


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
    learning_mode_enabled: bool | None = None


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
    learning_mode_enabled: bool | None = False

    class Config:
        from_attributes = True


# ── Lessons (modo aprendizaje) ──

class AgentLessonCreate(BaseModel):
    agent_id: str
    title: str
    lesson_text: str
    bad_response_example: str | None = None
    correct_response: str | None = None
    category: str | None = None
    is_active: bool = True
    priority: int | None = 5
    source_conversation_id: str | None = None


class AgentLessonUpdate(BaseModel):
    title: str | None = None
    lesson_text: str | None = None
    bad_response_example: str | None = None
    correct_response: str | None = None
    category: str | None = None
    is_active: bool | None = None
    priority: int | None = None


class AgentLessonResponse(BaseModel):
    id: str
    agent_id: str
    store_id: str
    title: str
    lesson_text: str
    bad_response_example: str | None = None
    correct_response: str | None = None
    category: str | None = None
    is_active: bool
    priority: int | None = 5
    source_conversation_id: str | None = None
    created_at: str | None = None

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
