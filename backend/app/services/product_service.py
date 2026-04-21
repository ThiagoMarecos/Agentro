"""
Servicio de productos.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.product import Product
from app.repos.product_repo import (
    get_by_id,
    get_by_slug,
    list_by_store,
    count_by_store,
    create as repo_create,
    update as repo_update,
    delete as repo_delete,
    duplicate as repo_duplicate,
    create_variant,
    update_variant,
    delete_variant,
    add_image,
    reorder_images,
    delete_image,
    get_variant_by_id,
)
from app.repos.category_repo import get_by_id as get_category_by_id
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductVariantCreate,
    ProductImageCreate,
    VariantCreateBody,
    ImageCreateBody,
)


def get_product(db: Session, product_id: str, store_id: str) -> Product:
    product = get_by_id(db, product_id, store_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


def list_products(
    db: Session,
    store_id: str,
    search: str | None = None,
    status: str | None = None,
    category_id: str | None = None,
    sort: str = "updated_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Product], int]:
    items = list_by_store(db, store_id, search, status, category_id, sort, order, skip, limit)
    total = count_by_store(db, store_id, search, status, category_id)
    return items, total


def _unique_slug(db: Session, base_slug: str, store_id: str) -> str:
    """Retorna el slug tal cual si está libre, o agrega -2, -3… hasta encontrar uno libre."""
    if not get_by_slug(db, base_slug, store_id):
        return base_slug
    counter = 2
    while True:
        candidate = f"{base_slug}-{counter}"
        if not get_by_slug(db, candidate, store_id):
            return candidate
        counter += 1


def create_product(db: Session, store_id: str, data: ProductCreate) -> Product:
    data.slug = _unique_slug(db, data.slug, store_id)
    if data.category_id:
        cat = get_category_by_id(db, data.category_id, store_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Categoría no encontrada o no pertenece a esta tienda")
    if data.has_variants and not data.variants:
        raise HTTPException(status_code=400, detail="Producto con variantes debe tener al menos una variante")
    if data.has_variants and data.variants:
        data.product_type = "variant"
    elif not data.has_variants:
        data.product_type = "simple"
    return repo_create(db, store_id, data)


def update_product(db: Session, product_id: str, store_id: str, data: ProductUpdate) -> Product:
    product = get_product(db, product_id, store_id)
    if data.slug is not None:
        existing = get_by_slug(db, data.slug, store_id)
        if existing and existing.id != product_id:
            raise HTTPException(status_code=409, detail="El slug ya está en uso en esta tienda")
    if data.category_id is not None:
        if data.category_id:
            cat = get_category_by_id(db, data.category_id, store_id)
            if not cat:
                raise HTTPException(status_code=400, detail="Categoría no encontrada o no pertenece a esta tienda")
    return repo_update(db, product, data)


def delete_product(db: Session, product_id: str, store_id: str) -> None:
    product = get_product(db, product_id, store_id)
    repo_delete(db, product)


def duplicate_product(db: Session, product_id: str, store_id: str, new_slug: str) -> Product:
    product = get_product(db, product_id, store_id)
    existing = get_by_slug(db, new_slug, store_id)
    if existing:
        raise HTTPException(status_code=409, detail="El slug ya está en uso en esta tienda")
    return repo_duplicate(db, product, new_slug)


def add_product_variant(db: Session, product_id: str, store_id: str, data: VariantCreateBody) -> "ProductVariant":
    from app.models.product import ProductVariant
    product = get_product(db, product_id, store_id)
    v_data = ProductVariantCreate(
        name=data.name,
        sku=data.sku,
        price=data.price,
        compare_at_price=data.compare_at_price,
        stock_quantity=data.stock_quantity,
        track_inventory=data.track_inventory,
        is_default=data.is_default,
        option_values=data.option_values,
    )
    return create_variant(db, product, v_data)


def update_product_variant(
    db: Session, product_id: str, variant_id: str, store_id: str, data: dict
) -> "ProductVariant":
    from app.models.product import ProductVariant
    product = get_product(db, product_id, store_id)
    variant = get_variant_by_id(db, variant_id, store_id)
    if not variant or variant.product_id != product_id:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    return update_variant(db, variant, data)


def remove_product_variant(db: Session, product_id: str, variant_id: str, store_id: str) -> None:
    product = get_product(db, product_id, store_id)
    variant = get_variant_by_id(db, variant_id, store_id)
    if not variant or variant.product_id != product_id:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    delete_variant(db, variant)


def add_product_image(db: Session, product_id: str, store_id: str, data: ImageCreateBody) -> "ProductImage":
    from app.models.product import ProductImage
    product = get_product(db, product_id, store_id)
    img_data = ProductImageCreate(
        url=data.url,
        alt_text=data.alt_text,
        sort_order=data.sort_order,
        is_cover=data.is_cover,
        variant_id=data.variant_id,
    )
    return add_image(db, product, img_data)


def reorder_product_images(db: Session, product_id: str, store_id: str, image_ids: list[str]) -> None:
    product = get_product(db, product_id, store_id)
    reorder_images(db, product, image_ids)


def remove_product_image(db: Session, product_id: str, image_id: str, store_id: str) -> None:
    product = get_product(db, product_id, store_id)
    delete_image(db, product, image_id)
