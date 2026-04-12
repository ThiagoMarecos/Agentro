"""
Endpoints públicos del storefront.
Sin autenticación. Filtrado por slug de tienda.
"""

import uuid
import random
import string
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import Store, StorePage
from app.models.product import Product
from app.models.next_drop import NextDropItem
from app.models.order import Order, OrderItem
from app.models.customer import Customer, Address
from app.repos.store_repo import get_by_slug
from app.services.theme_service import get_store_theme, get_theme_config
from app.schemas.order import StorefrontOrderCreate, OrderResponse, OrderItemResponse

router = APIRouter()


def get_store_by_slug(db: Session, slug: str) -> Store:
    store = get_by_slug(db, slug)
    if not store:
        raise HTTPException(status_code=404, detail="Tienda no encontrada")
    if not store.is_active:
        raise HTTPException(status_code=403, detail="STORE_SUSPENDED")
    return store


@router.get("/{slug}")
def get_store_public(slug: str, db: Session = Depends(get_db)):
    """Datos públicos de la tienda para storefront."""
    store = get_store_by_slug(db, slug)
    theme = get_store_theme(db, store.id)
    theme_config = get_theme_config(theme) if theme else get_theme_config(None)
    return {
        "id": store.id,
        "name": store.name,
        "slug": store.slug,
        "description": store.description,
        "currency": store.currency,
        "language": store.language,
        "logo_url": getattr(store, "logo_url", None),
        "favicon_url": getattr(store, "favicon_url", None),
        "support_email": getattr(store, "support_email", None),
        "template_id": store.template_id or "minimal",
        "theme": {
            "template_name": theme.template_name if theme else "minimal",
            "custom_config": theme_config,
        },
    }


@router.get("/{slug}/products")
def list_store_products(
    slug: str,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    q: str | None = None,
):
    """Lista productos públicos de la tienda (status=active, is_active=True)."""
    store = get_store_by_slug(db, slug)
    query = db.query(Product).filter(
        Product.store_id == store.id,
        Product.is_active == True,
        Product.status == "active",
    )
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(Product.name.ilike(term))
    products = query.offset(skip).limit(limit).all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "description": p.description,
            "price": str(p.price),
            "compare_at_price": str(p.compare_at_price) if p.compare_at_price else None,
            "cover_image_url": getattr(p, "cover_image_url", None) or (p.images[0].url if p.images else None),
            "images": [{"url": i.url, "alt": i.alt_text} for i in (p.images or [])],
        }
        for p in products
    ]


@router.get("/{slug}/products/{product_id}")
def get_store_product(
    slug: str,
    product_id: str,
    db: Session = Depends(get_db),
):
    """Detalle de producto público."""
    store = get_store_by_slug(db, slug)
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.store_id == store.id,
        Product.is_active == True,
        Product.status == "active",
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return {
        "id": product.id,
        "name": product.name,
        "slug": product.slug,
        "description": product.description,
        "price": str(product.price),
        "compare_at_price": str(product.compare_at_price) if product.compare_at_price else None,
        "sku": product.sku,
        "cover_image_url": getattr(product, "cover_image_url", None) or (product.images[0].url if product.images else None),
        "images": [{"url": i.url, "alt": i.alt_text} for i in (product.images or [])],
        "variants": [
            {"id": v.id, "name": v.name, "price": str(v.price), "stock_quantity": v.stock_quantity}
            for v in (product.variants or [])
        ],
    }


@router.get("/{slug}/drops")
def list_store_drops(slug: str, db: Session = Depends(get_db)):
    """Lista próximos drops públicos."""
    store = get_store_by_slug(db, slug)
    items = db.query(NextDropItem).filter(
        NextDropItem.store_id == store.id,
        NextDropItem.is_active == True,
    ).order_by(NextDropItem.sort_order).all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "description": i.description,
            "drop_date": i.drop_date.isoformat() if i.drop_date else None,
            "image_url": i.image_url,
        }
        for i in items
    ]


def _parse_blocks(raw):
    if not raw:
        return []
    try:
        import json
        return json.loads(raw) if isinstance(raw, str) else raw
    except (json.JSONDecodeError, TypeError):
        return []


@router.get("/{slug}/pages")
def get_store_pages(slug: str, db: Session = Depends(get_db)):
    store = get_store_by_slug(db, slug)
    pages = db.query(StorePage).filter(
        StorePage.store_id == store.id,
        StorePage.is_published == True,
    ).order_by(StorePage.sort_order).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "blocks": _parse_blocks(p.blocks),
        }
        for p in pages
    ]


@router.get("/{slug}/pages/{page_slug}")
def get_store_page(slug: str, page_slug: str, db: Session = Depends(get_db)):
    store = get_store_by_slug(db, slug)
    page = db.query(StorePage).filter(
        StorePage.store_id == store.id,
        StorePage.slug == page_slug,
        StorePage.is_published == True,
    ).first()
    if not page:
        raise HTTPException(404, "Página no encontrada")
    return {
        "id": page.id,
        "title": page.title,
        "slug": page.slug,
        "blocks": _parse_blocks(page.blocks),
    }


def _generate_order_number() -> str:
    ts = string.digits
    return "NX-" + "".join(random.choices(ts, k=8))


@router.post("/{slug}/orders")
def create_storefront_order(
    slug: str,
    payload: StorefrontOrderCreate,
    db: Session = Depends(get_db),
):
    """Crea un pedido desde el storefront público (sin auth)."""
    store = get_store_by_slug(db, slug)

    if not payload.items:
        raise HTTPException(400, "El pedido debe tener al menos un producto")

    customer = db.query(Customer).filter(
        Customer.store_id == store.id,
        Customer.email == payload.email,
    ).first()
    if not customer:
        customer = Customer(
            id=str(uuid.uuid4()),
            store_id=store.id,
            email=payload.email,
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone=payload.phone,
        )
        db.add(customer)
        db.flush()

    if payload.address:
        address = Address(
            id=str(uuid.uuid4()),
            customer_id=customer.id,
            address_line1=payload.address,
            city=payload.city,
            state=payload.state,
            postal_code=payload.postal_code,
            country="AR",
        )
        db.add(address)

    subtotal = Decimal("0")
    order_items: list[OrderItem] = []

    for item in payload.items:
        product = db.query(Product).filter(
            Product.id == item.product_id,
            Product.store_id == store.id,
        ).first()
        if not product:
            raise HTTPException(400, f"Producto {item.product_id} no encontrado")

        unit_price = Decimal(str(product.price))
        total_price = unit_price * item.quantity
        subtotal += total_price

        order_items.append(OrderItem(
            id=str(uuid.uuid4()),
            product_id=product.id,
            variant_id=item.variant_id,
            name=product.name,
            sku=product.sku,
            quantity=item.quantity,
            unit_price=unit_price,
            total_price=total_price,
        ))

    order = Order(
        id=str(uuid.uuid4()),
        store_id=store.id,
        customer_id=customer.id,
        order_number=_generate_order_number(),
        subtotal=subtotal,
        total=subtotal,
        currency=store.currency or "USD",
        notes=payload.notes or None,
    )
    db.add(order)
    db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    db.commit()
    db.refresh(order)

    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "subtotal": str(order.subtotal),
        "total": str(order.total),
        "currency": order.currency,
        "items": [
            {
                "id": oi.id,
                "name": oi.name,
                "quantity": oi.quantity,
                "unit_price": str(oi.unit_price),
                "total_price": str(oi.total_price),
            }
            for oi in order.items
        ],
    }
