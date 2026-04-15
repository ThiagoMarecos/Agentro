"""
Schemas del endpoint de chat.
"""

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    channel: str = Field(default="web_chat", max_length=50)
    customer_identifier: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=4096)


class ChatMessageResponse(BaseModel):
    response: str
    conversation_id: str
    session_id: str
    stage: str
