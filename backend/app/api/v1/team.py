"""
Endpoints del sistema de equipo.

Rutas:
  GET    /team/members              — listar miembros (owner+manager)
  PATCH  /team/members/{id}         — cambiar rol (owner only)
  DELETE /team/members/{id}         — quitar miembro (owner only)

  GET    /team/invitations          — listar invitaciones pendientes (owner+manager)
  POST   /team/invitations          — crear + enviar email (owner+manager)
  DELETE /team/invitations/{id}     — revocar invitación pendiente (owner+manager)

Rutas públicas (sin store header):
  GET    /team/invite/{token}       — obtener detalles de invitación (sin auth)
  POST   /team/invite/{token}/accept — aceptar invitación (auth opcional)
"""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.dependencies import get_current_store, require_role
from app.core.security import get_password_hash
from app.db.session import get_db
from app.models.store import Store, StoreMember
from app.models.team import TeamInvitation, INVITATION_TTL_DAYS
from app.models.user import User, RoleEnum
from app.schemas.team import (
    AcceptInvitationRequest,
    AcceptInvitationResponse,
    AssignableRole,
    CreateInvitationRequest,
    InvitationResponse,
    TeamMemberResponse,
    UpdateMemberRoleRequest,
)
from app.api.v1.auth import get_current_user, get_current_user_optional
from app.services.email_service import send_team_invitation
from app.services.audit_service import log_action

router = APIRouter()


# ════════════════════════════════════════════════════════════════════
#  Helpers
# ════════════════════════════════════════════════════════════════════

def _require_manager_or_owner(
    store: Store, user: User
) -> StoreMember:
    """Solo owner/admin/manager pueden gestionar el equipo."""
    return require_role(store, user, RoleEnum.MANAGER)


def _require_owner(store: Store, user: User) -> StoreMember:
    """Solo owner/admin pueden cambiar roles o eliminar miembros."""
    return require_role(store, user, RoleEnum.ADMIN)


def _generate_token() -> str:
    """Token URL-safe de 64 chars."""
    return secrets.token_urlsafe(48)[:64]


def _build_accept_url(token: str) -> str:
    """URL pública del frontend para aceptar la invitación."""
    settings = get_settings()
    base = (settings.frontend_url or "https://getagentro.com").rstrip("/")
    return f"{base}/team-invite/{token}"


def _serialize_member(member: StoreMember, user: User) -> TeamMemberResponse:
    return TeamMemberResponse(
        id=member.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        role=member.role,
        joined_at=member.created_at,
    )


def _serialize_invitation(
    inv: TeamInvitation,
    inviter: User | None = None,
    accept_url: str | None = None,
) -> InvitationResponse:
    return InvitationResponse(
        id=inv.id,
        store_id=inv.store_id,
        email=inv.email,
        role=inv.role,
        status=inv.status,
        expires_at=inv.expires_at,
        accepted_at=inv.accepted_at,
        created_at=inv.created_at,
        invited_by_name=(inviter.full_name or inviter.email) if inviter else None,
        accept_url=accept_url,
    )


# ════════════════════════════════════════════════════════════════════
#  Members CRUD
# ════════════════════════════════════════════════════════════════════

@router.get("/members", response_model=list[TeamMemberResponse])
def list_members(
    request: Request,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista todos los miembros del equipo. Requiere rol >= manager."""
    _require_manager_or_owner(store, user)

    members = (
        db.query(StoreMember)
        .filter(StoreMember.store_id == store.id)
        .order_by(StoreMember.created_at.asc())
        .all()
    )
    results: list[TeamMemberResponse] = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            results.append(_serialize_member(m, u))
    return results


@router.patch("/members/{member_id}", response_model=TeamMemberResponse)
def update_member_role(
    member_id: str,
    payload: UpdateMemberRoleRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cambia el rol de un miembro. Solo owner/admin."""
    _require_owner(store, user)

    member = (
        db.query(StoreMember)
        .filter(StoreMember.id == member_id, StoreMember.store_id == store.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    if member.role == RoleEnum.OWNER.value:
        raise HTTPException(status_code=403, detail="No se puede cambiar el rol del dueño")

    if member.user_id == user.id:
        raise HTTPException(status_code=400, detail="No podés cambiar tu propio rol")

    old_role = member.role
    member.role = payload.role
    db.add(member)
    db.commit()
    db.refresh(member)

    log_action(
        db,
        "team.member_role_changed",
        user_id=user.id,
        store_id=store.id,
        resource_type="store_member",
        resource_id=member.id,
        details={"from": old_role, "to": payload.role},
    )

    u = db.query(User).filter(User.id == member.user_id).first()
    if not u:
        raise HTTPException(status_code=500, detail="User no encontrado")
    return _serialize_member(member, u)


@router.delete("/members/{member_id}", status_code=204)
def remove_member(
    member_id: str,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Quita un miembro del equipo. Solo owner/admin. No se puede quitar al owner."""
    _require_owner(store, user)

    member = (
        db.query(StoreMember)
        .filter(StoreMember.id == member_id, StoreMember.store_id == store.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    if member.role == RoleEnum.OWNER.value:
        raise HTTPException(status_code=403, detail="No se puede quitar al dueño")

    if member.user_id == user.id:
        raise HTTPException(status_code=400, detail="No podés quitarte a vos mismo")

    db.delete(member)
    db.commit()

    log_action(
        db,
        "team.member_removed",
        user_id=user.id,
        store_id=store.id,
        resource_type="store_member",
        resource_id=member_id,
        details={"removed_user_id": member.user_id},
    )


# ════════════════════════════════════════════════════════════════════
#  Invitations
# ════════════════════════════════════════════════════════════════════

@router.get("/invitations", response_model=list[InvitationResponse])
def list_invitations(
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista invitaciones de la tienda (todas, no solo pending)."""
    _require_manager_or_owner(store, user)

    invs = (
        db.query(TeamInvitation)
        .filter(TeamInvitation.store_id == store.id)
        .order_by(TeamInvitation.created_at.desc())
        .all()
    )
    results: list[InvitationResponse] = []
    for inv in invs:
        inviter = None
        if inv.invited_by_user_id:
            inviter = db.query(User).filter(User.id == inv.invited_by_user_id).first()
        results.append(_serialize_invitation(inv, inviter=inviter))
    return results


@router.post("/invitations", response_model=InvitationResponse)
def create_invitation(
    payload: CreateInvitationRequest,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea una invitación + envía el email."""
    _require_manager_or_owner(store, user)

    # Bloquear si ya hay un user con ese email que ya es miembro
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        existing_member = (
            db.query(StoreMember)
            .filter(
                StoreMember.store_id == store.id,
                StoreMember.user_id == existing_user.id,
            )
            .first()
        )
        if existing_member:
            raise HTTPException(
                status_code=400,
                detail=f"{payload.email} ya es miembro del equipo",
            )

    # Si ya hay una invitación pending para este email, la revocamos antes
    existing_invs = (
        db.query(TeamInvitation)
        .filter(
            TeamInvitation.store_id == store.id,
            TeamInvitation.email == payload.email,
            TeamInvitation.status == "pending",
        )
        .all()
    )
    for old in existing_invs:
        old.status = "revoked"
        db.add(old)

    inv = TeamInvitation(
        store_id=store.id,
        invited_by_user_id=user.id,
        email=payload.email,
        role=payload.role,
        token=_generate_token(),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    accept_url = _build_accept_url(inv.token)

    # Mandar email (no bloquea si falla)
    inviter_name = user.full_name or user.email.split("@")[0]
    sent = send_team_invitation(
        to_email=payload.email,
        store_name=store.name,
        inviter_name=inviter_name,
        role=payload.role,
        accept_url=accept_url,
    )

    log_action(
        db,
        "team.invitation_sent" if sent else "team.invitation_created_no_email",
        user_id=user.id,
        store_id=store.id,
        resource_type="team_invitation",
        resource_id=inv.id,
        details={"email": payload.email, "role": payload.role, "email_sent": sent},
    )

    return _serialize_invitation(inv, inviter=user, accept_url=accept_url)


@router.delete("/invitations/{invitation_id}", status_code=204)
def revoke_invitation(
    invitation_id: str,
    store: Store = Depends(get_current_store),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoca una invitación pendiente."""
    _require_manager_or_owner(store, user)

    inv = (
        db.query(TeamInvitation)
        .filter(TeamInvitation.id == invitation_id, TeamInvitation.store_id == store.id)
        .first()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitación ya está {inv.status}")

    inv.status = "revoked"
    db.add(inv)
    db.commit()

    log_action(
        db,
        "team.invitation_revoked",
        user_id=user.id,
        store_id=store.id,
        resource_type="team_invitation",
        resource_id=inv.id,
    )


# ════════════════════════════════════════════════════════════════════
#  Public invitation flow (sin X-Store-ID)
# ════════════════════════════════════════════════════════════════════

@router.get("/invite/{token}/info")
def get_invitation_info(token: str, db: Session = Depends(get_db)):
    """
    Detalles públicos de una invitación. Sin auth porque el invitado todavía
    no tiene cuenta. Solo expone lo necesario para mostrar la pantalla.
    """
    inv = db.query(TeamInvitation).filter(TeamInvitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")

    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitación {inv.status}")

    if inv.is_expired():
        # Marcamos expired si pasó del TTL pero seguía pending
        inv.status = "expired"
        db.add(inv)
        db.commit()
        raise HTTPException(status_code=400, detail="Invitación vencida")

    store = db.query(Store).filter(Store.id == inv.store_id).first()
    inviter = None
    if inv.invited_by_user_id:
        inviter = db.query(User).filter(User.id == inv.invited_by_user_id).first()

    # Si ya existe un User con este email, le decimos al frontend que solo se logue
    existing_user = db.query(User).filter(User.email == inv.email).first()

    return {
        "email": inv.email,
        "role": inv.role,
        "store_name": store.name if store else "—",
        "inviter_name": (inviter.full_name or inviter.email) if inviter else None,
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        "user_exists": bool(existing_user),
    }


@router.post("/invite/{token}/accept", response_model=AcceptInvitationResponse)
def accept_invitation(
    token: str,
    payload: AcceptInvitationRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Acepta una invitación.

    - Si el invitado YA tiene cuenta y está logueado → solo lo asociamos a la
      tienda con el rol de la invitación.
    - Si el invitado YA tiene cuenta pero NO está logueado → devolvemos
      requires_login=True para que el frontend lo mande a /login.
    - Si NO tiene cuenta → la creamos con email + password (o sin password si
      quiere solo OAuth, pero por ahora pedimos password).
    """
    inv = db.query(TeamInvitation).filter(TeamInvitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitación {inv.status}")
    if inv.is_expired():
        inv.status = "expired"
        db.add(inv)
        db.commit()
        raise HTTPException(status_code=400, detail="Invitación vencida")

    # Caso 1: usuario ya existe
    target_user = db.query(User).filter(User.email == inv.email).first()
    if target_user:
        # Si no está logueado o el logueado es otro, pedimos login
        if not current_user or current_user.id != target_user.id:
            return AcceptInvitationResponse(
                success=False,
                store_id=inv.store_id,
                store_name="",
                role=inv.role,
                user_id=target_user.id,
                requires_login=True,
            )

    # Caso 2: usuario no existe → crear
    if not target_user:
        if not payload.password or len(payload.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password requerido (mínimo 6 caracteres) para crear la cuenta",
            )
        target_user = User(
            email=inv.email,
            full_name=(payload.full_name or "").strip() or None,
            hashed_password=get_password_hash(payload.password),
            is_active=True,
            is_verified=True,  # confiamos en el flujo de invitación
            auth_provider="email",
        )
        db.add(target_user)
        db.commit()
        db.refresh(target_user)

    # Asociar a la tienda con el rol invitado (idempotente)
    existing = (
        db.query(StoreMember)
        .filter(
            StoreMember.store_id == inv.store_id,
            StoreMember.user_id == target_user.id,
        )
        .first()
    )
    if existing:
        # Ya era miembro: actualizamos el rol al de la invitación si es distinto
        if existing.role != inv.role and existing.role != RoleEnum.OWNER.value:
            existing.role = inv.role
            db.add(existing)
    else:
        db.add(StoreMember(
            store_id=inv.store_id,
            user_id=target_user.id,
            role=inv.role,
        ))

    inv.status = "accepted"
    inv.accepted_at = datetime.now(timezone.utc)
    inv.accepted_by_user_id = target_user.id
    db.add(inv)
    db.commit()

    log_action(
        db,
        "team.invitation_accepted",
        user_id=target_user.id,
        store_id=inv.store_id,
        resource_type="team_invitation",
        resource_id=inv.id,
        details={"role": inv.role},
    )

    store = db.query(Store).filter(Store.id == inv.store_id).first()
    return AcceptInvitationResponse(
        success=True,
        store_id=inv.store_id,
        store_name=store.name if store else "",
        role=inv.role,
        user_id=target_user.id,
        requires_login=False,
    )
