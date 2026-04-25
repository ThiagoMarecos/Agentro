"""
Schemas Pydantic para el sistema de equipo.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr


# Roles que se pueden asignar via la UI de equipo (excluye owner — ese se
# crea automáticamente con la tienda).
AssignableRole = Literal["manager", "seller", "support"]


# ── Members (StoreMember + User) ──

class TeamMemberResponse(BaseModel):
    """Representación de un miembro del equipo en la UI."""
    model_config = ConfigDict(from_attributes=True)

    id: str  # store_member id
    user_id: str
    email: str
    full_name: str | None = None
    avatar_url: str | None = None
    role: str
    joined_at: datetime  # = StoreMember.created_at


class UpdateMemberRoleRequest(BaseModel):
    role: AssignableRole


# ── Invitations ──

class CreateInvitationRequest(BaseModel):
    email: EmailStr
    role: AssignableRole


class InvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    store_id: str
    email: str
    role: str
    status: str
    expires_at: datetime
    accepted_at: datetime | None = None
    created_at: datetime
    invited_by_name: str | None = None
    accept_url: str | None = None  # solo se devuelve en POST (response inmediato al creator)


class AcceptInvitationRequest(BaseModel):
    """Lo que envía la página /team-invite/[token] al aceptar."""
    full_name: str | None = None
    password: str | None = None  # opcional si se loggea via Google


class AcceptInvitationResponse(BaseModel):
    success: bool
    store_id: str
    store_name: str
    role: str
    user_id: str
    requires_login: bool = False  # True si la cuenta ya existía y debe loguearse


# ── Conversation assignment ──

class AssignConversationRequest(BaseModel):
    user_id: str | None = None  # None = desasignar


class AssignConversationResponse(BaseModel):
    conversation_id: str
    assigned_user_id: str | None
    assigned_at: datetime | None
    needs_seller_assignment: bool


class TakeControlRequest(BaseModel):
    """No tiene fields — el endpoint usa el conversation_id del path."""
    pass


class TakeControlResponse(BaseModel):
    conversation_id: str
    agent_paused: bool
