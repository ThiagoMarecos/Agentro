"""API endpoints for custom store pages."""

import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_store
from app.models.store import Store, StorePage

router = APIRouter()


class PageCreate(BaseModel):
    title: str
    slug: str
    blocks: list = []
    is_published: bool = False


class PageUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    blocks: list | None = None
    is_published: bool | None = None
    sort_order: int | None = None


class PageResponse(BaseModel):
    id: str
    title: str
    slug: str
    blocks: list
    is_published: bool
    sort_order: int
    created_at: str | None = None


def _parse_blocks(raw):
    if not raw:
        return []
    try:
        return json.loads(raw) if isinstance(raw, str) else raw
    except (json.JSONDecodeError, TypeError):
        return []


def _page_dict(p, blocks=None):
    return {
        "id": p.id,
        "title": p.title,
        "slug": p.slug,
        "blocks": blocks if blocks is not None else _parse_blocks(p.blocks),
        "is_published": p.is_published,
        "sort_order": p.sort_order,
        "created_at": str(p.created_at) if p.created_at else None,
    }


@router.get("")
def list_pages(store: Store = Depends(get_current_store), db: Session = Depends(get_db)):
    pages = db.query(StorePage).filter(StorePage.store_id == store.id).order_by(StorePage.sort_order).all()
    return [_page_dict(p) for p in pages]


@router.post("")
def create_page(data: PageCreate, store: Store = Depends(get_current_store), db: Session = Depends(get_db)):
    existing = db.query(StorePage).filter(StorePage.store_id == store.id, StorePage.slug == data.slug).first()
    if existing:
        raise HTTPException(400, "Ya existe una página con ese slug")
    page = StorePage(
        id=str(uuid.uuid4()),
        store_id=store.id,
        title=data.title,
        slug=data.slug,
        blocks=json.dumps(data.blocks),
        is_published=data.is_published,
    )
    db.add(page)
    db.commit()
    db.refresh(page)
    return _page_dict(page, blocks=data.blocks)


@router.patch("/{page_id}")
def update_page(page_id: str, data: PageUpdate, store: Store = Depends(get_current_store), db: Session = Depends(get_db)):
    page = db.query(StorePage).filter(StorePage.id == page_id, StorePage.store_id == store.id).first()
    if not page:
        raise HTTPException(404, "Página no encontrada")
    if data.title is not None:
        page.title = data.title
    if data.slug is not None:
        page.slug = data.slug
    if data.blocks is not None:
        page.blocks = json.dumps(data.blocks)
    if data.is_published is not None:
        page.is_published = data.is_published
    if data.sort_order is not None:
        page.sort_order = data.sort_order
    db.commit()
    db.refresh(page)
    return _page_dict(page)


@router.delete("/{page_id}")
def delete_page(page_id: str, store: Store = Depends(get_current_store), db: Session = Depends(get_db)):
    page = db.query(StorePage).filter(StorePage.id == page_id, StorePage.store_id == store.id).first()
    if not page:
        raise HTTPException(404, "Página no encontrada")
    db.delete(page)
    db.commit()
    return {"ok": True}
