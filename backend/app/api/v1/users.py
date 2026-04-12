"""
Endpoints de usuarios.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.security import verify_password, get_password_hash
from app.models.user import User
from app.models.store import Store, StoreMember

router = APIRouter()


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    """Obtiene perfil del usuario actual."""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "auth_provider": user.auth_provider,
        "is_verified": user.is_verified,
        "created_at": str(user.created_at) if user.created_at else None,
    }


@router.patch("/me")
def update_me(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Actualiza perfil del usuario."""
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url or None
    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "auth_provider": user.auth_provider,
        "is_verified": user.is_verified,
    }


@router.patch("/me/password")
def change_password(
    data: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cambia la contraseña del usuario."""
    if user.auth_provider != "email":
        raise HTTPException(400, "No podés cambiar la contraseña de una cuenta OAuth")
    if not user.hashed_password:
        raise HTTPException(400, "Esta cuenta no tiene contraseña configurada")
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(400, "La contraseña actual es incorrecta")
    if len(data.new_password) < 6:
        raise HTTPException(400, "La nueva contraseña debe tener al menos 6 caracteres")

    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"ok": True, "message": "Contraseña actualizada"}


@router.delete("/me")
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Elimina la cuenta del usuario y sus membresías."""
    from app.models.order import Order

    memberships = db.query(StoreMember).filter(StoreMember.user_id == user.id).all()
    safe_statuses = {"delivered", "cancelled"}

    blocking_stores: list[str] = []
    total_pending = 0
    for m in memberships:
        other_members = db.query(StoreMember).filter(
            StoreMember.store_id == m.store_id,
            StoreMember.user_id != user.id,
        ).count()
        if other_members == 0:
            pending = db.query(Order).filter(
                Order.store_id == m.store_id,
                ~Order.status.in_(safe_statuses),
            ).count()
            if pending > 0:
                store = db.query(Store).filter(Store.id == m.store_id).first()
                blocking_stores.append(store.name if store else m.store_id)
                total_pending += pending

    if blocking_stores:
        names = ", ".join(blocking_stores)
        raise HTTPException(
            status_code=409,
            detail=f"No podés eliminar tu cuenta porque tenés {total_pending} pedido{'s' if total_pending != 1 else ''} sin completar en: {names}. Enviá o cancelá todos los pedidos pendientes antes de eliminar tu cuenta.",
        )

    for m in memberships:
        other_members = db.query(StoreMember).filter(
            StoreMember.store_id == m.store_id,
            StoreMember.user_id != user.id,
        ).count()
        if other_members == 0:
            store = db.query(Store).filter(Store.id == m.store_id).first()
            if store:
                db.delete(store)
        db.delete(m)

    db.delete(user)
    db.commit()
    return {"ok": True, "message": "Cuenta eliminada"}
