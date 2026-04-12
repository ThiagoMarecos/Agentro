"""
Schemas del endpoint de chat.
"""

from pydantic import BaseModel


class ChatMessageRequest(BaseModel):
    channel: str = "web_chat"
    customer_identifier: str
    message: str


class ChatMessageResponse(BaseModel):
    response: str
    conversation_id: str
    session_id: str
    stage: str
