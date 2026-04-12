"""
Repositorio de categorías.
"""

from sqlalchemy.orm import Session

from app.models.product import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


def get_by_id(db: Session, category_id: str, store_id: str) -> Category | None:
    return db.query(Category).filter(
        Category.id == category_id,
        Category.store_id == store_id,
    ).first()


def get_by_slug(db: Session, slug: str, store_id: str) -> Category | None:
    return db.query(Category).filter(
        Category.slug == slug.lower().strip(),
        Category.store_id == store_id,
    ).first()


def list_by_store(db: Session, store_id: str) -> list[Category]:
    return db.query(Category).filter(Category.store_id == store_id).order_by(Category.sort_order).all()


def create(db: Session, store_id: str, data: CategoryCreate) -> Category:
    cat = Category(
        store_id=store_id,
        name=data.name,
        slug=data.slug,
        description=data.description,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update(db: Session, category: Category, data: CategoryUpdate) -> Category:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


def delete(db: Session, category: Category) -> None:
    for p in category.products:
        p.category_id = None
    db.delete(category)
    db.commit()
