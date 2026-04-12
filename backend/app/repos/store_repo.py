"""
Repositorio de tiendas.
"""

from sqlalchemy.orm import Session

from app.models.store import Store, StoreMember, StoreTheme
from app.models.settings import Setting
from app.schemas.store import StoreCreate


def get_by_slug(db: Session, slug: str) -> Store | None:
    return db.query(Store).filter(Store.slug == slug).first()


def get_by_id(db: Session, store_id: str) -> Store | None:
    return db.query(Store).filter(Store.id == store_id).first()


def get_user_stores(db: Session, user_id: str) -> list[Store]:
    memberships = db.query(StoreMember).filter(StoreMember.user_id == user_id).all()
    store_ids = [m.store_id for m in memberships]
    return db.query(Store).filter(Store.id.in_(store_ids)).all()


def create(db: Session, user_id: str, data: StoreCreate) -> Store:
    store = Store(
        name=data.name,
        slug=data.slug,
        industry=data.industry,
        country=data.country,
        currency=data.currency,
        language=data.language,
        template_id=data.template_id,
    )
    db.add(store)
    db.flush()

    member = StoreMember(store_id=store.id, user_id=user_id, role="owner")
    db.add(member)

    theme = StoreTheme(
        store_id=store.id,
        template_name=data.template_id or "minimal",
    )
    db.add(theme)

    for key, value in [("store_name", data.name), ("currency", data.currency)]:
        setting = Setting(store_id=store.id, key=key, value=value)
        db.add(setting)

    db.commit()
    db.refresh(store)
    return store
