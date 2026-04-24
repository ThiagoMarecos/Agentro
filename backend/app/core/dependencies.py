"""
Dependencias compartidas para contexto multi-tenant.
"""

from fastapi import HTTPException, Request, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import Store, StoreMember
from app.models.user import User, RoleEnum
from app.api.v1.auth import get_current_user

ROLE_ORDER = {RoleEnum.OWNER: 4, RoleEnum.ADMIN: 3, RoleEnum.MANAGER: 2, RoleEnum.SUPPORT: 1}


def require_role(store: Store, user: User, min_role: RoleEnum) -> StoreMember:
    """Valida que el usuario tenga al menos el rol mínimo. owner > admin > manager > support."""
    member = (
        next((m for m in store.members if m.user_id == user.id), None)
        or next(
            (
                m
                for m in user.store_memberships
                if m.store_id == store.id
            ),
            None,
        )
    )
    if not member:
        raise HTTPException(status_code=403, detail="Sin acceso a esta tienda")
    try:
        user_role = RoleEnum(member.role)
    except ValueError:
        raise HTTPException(status_code=403, detail="Rol inválido")
    if ROLE_ORDER.get(user_role, 0) < ROLE_ORDER.get(min_role, 0):
        raise HTTPException(status_code=403, detail="Permisos insuficientes")
    return member


async def require_superadmin(user: User = Depends(get_current_user)) -> User:
    """Valida que el usuario sea superadmin de Nexora."""
    if not getattr(user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Acceso denegado: se requiere Super Admin")
    return user


def get_store_id_from_request(request: Request) -> str | None:
    """Obtiene store_id de header X-Store-ID o query ?store_id=."""
    store_id = request.headers.get("X-Store-ID")
    if not store_id:
        store_id = request.query_params.get("store_id")
    return store_id


def get_current_store(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Store:
    """
    Obtiene la tienda actual validando que el usuario sea miembro.
    store_id puede venir de X-Store-ID, query store_id, o path.

    Excepción: superadmin tiene acceso a CUALQUIER tienda (sin membership check)
    para poder operar el panel /admin con métricas/lecciones cross-store.
    """
    store_id = get_store_id_from_request(request)
    if not store_id:
        raise HTTPException(
            status_code=400,
            detail="X-Store-ID header o store_id en query requerido",
        )

    # Superadmin: bypass de membership, sólo valida que la tienda exista y esté activa
    if getattr(user, "is_superadmin", False):
        store = db.query(Store).filter(Store.id == store_id).first()
        if not store:
            store = db.query(Store).filter(Store.slug == store_id).first()
        if not store:
            raise HTTPException(status_code=404, detail="Tienda no encontrada")
        if not store.is_active:
            raise HTTPException(status_code=403, detail="STORE_SUSPENDED")
        return store

    member = db.query(StoreMember).filter(
        StoreMember.store_id == store_id,
        StoreMember.user_id == user.id,
    ).first()

    if not member:
        store = db.query(Store).filter(Store.slug == store_id).first()
        if store:
            member = db.query(StoreMember).filter(
                StoreMember.store_id == store.id,
                StoreMember.user_id == user.id,
            ).first()
        if not member:
            raise HTTPException(status_code=403, detail="Sin acceso a esta tienda")

    store = db.query(Store).filter(Store.id == member.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    if not store.is_active:
        raise HTTPException(status_code=403, detail="STORE_SUSPENDED")

    return store


def get_current_store_with_role(min_role: RoleEnum = RoleEnum.SUPPORT):
    """Dependencia que retorna store y valida rol mínimo."""

    def _get(
        request: Request,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> tuple[Store, StoreMember]:
        store = get_current_store(request, user, db)
        member = require_role(store, user, min_role)
        return store, member

    return Depends(_get)


def get_store_by_slug_or_id(
    slug_or_id: str,
    db: Session,
    user: User | None = None,
    check_membership: bool = False,
) -> Store | None:
    """Obtiene Store por slug o id. Si check_membership, valida que user sea miembro."""
    store = db.query(Store).filter(Store.id == slug_or_id).first()
    if not store:
        store = db.query(Store).filter(Store.slug == slug_or_id).first()

    if not store:
        return None

    if check_membership and user:
        member = db.query(StoreMember).filter(
            StoreMember.store_id == store.id,
            StoreMember.user_id == user.id,
        ).first()
        if not member:
            return None

    return store
