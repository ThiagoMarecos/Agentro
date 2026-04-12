"""
Endpoints de productos.
"""

from fastapi import APIRouter, Depends, Request, Query, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.auth import get_current_user
from app.core.dependencies import get_current_store
from app.models.store import Store
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    PaginatedProductResponse,
    VariantCreateBody,
    VariantUpdateBody,
    ImageCreateBody,
    ImageReorderBody,
)
from app.services.product_service import (
    get_product,
    list_products,
    create_product,
    update_product,
    delete_product,
    duplicate_product,
    add_product_variant,
    update_product_variant,
    remove_product_variant,
    add_product_image,
    reorder_product_images,
    remove_product_image,
)
from app.services.audit_service import log_action, get_client_info
from app.schemas.product import CategorySummary, ProductVariantResponse, ProductImageResponse
from app.services.ai_prefill_service import ai_prefill_product
from app.services.import_service import import_products
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class AIPrefillRequest(BaseModel):
    description: str


class BulkImportProduct(BaseModel):
    name: str
    description: str | None = None
    price: float | None = None
    compare_at_price: float | None = None
    sku: str | None = None
    image_urls: list[str] = []
    stock_quantity: int | None = None


class BulkImportRequest(BaseModel):
    products: list[BulkImportProduct]


class BulkDeleteRequest(BaseModel):
    product_ids: list[str]


@router.post("/bulk-import")
def bulk_import(
    data: BulkImportRequest,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Importa múltiples productos de una vez (desde web scraping).
    Los crea como borradores con status 'draft'.
    """
    try:
        products_data = [
            {
                "name": p.name,
                "description": p.description,
                "price": p.price,
                "compare_at_price": p.compare_at_price,
                "sku": p.sku,
                "image_urls": p.image_urls,
                "stock_quantity": p.stock_quantity,
                "selected": True,
            }
            for p in data.products
        ]
        created, images = import_products(db, store.id, products_data)
        return {
            "success": True,
            "products_imported": created,
            "images_downloaded": images,
        }
    except Exception as e:
        logger.exception("bulk-import failed")
        raise HTTPException(status_code=500, detail=f"Error al importar: {str(e)}")


@router.post("/bulk-delete")
def bulk_delete(
    data: BulkDeleteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Elimina múltiples productos de una vez.
    Acepta una lista de product_ids y elimina todos los que pertenezcan a la tienda.
    """
    if not data.product_ids:
        raise HTTPException(status_code=400, detail="No se proporcionaron productos para eliminar")
    if len(data.product_ids) > 500:
        raise HTTPException(status_code=400, detail="Máximo 500 productos por operación")

    deleted_count = 0
    deleted_names = []
    errors = []

    for pid in data.product_ids:
        try:
            product = get_product(db, pid, store.id)
            deleted_names.append(product.name)
            delete_product(db, pid, store.id)
            deleted_count += 1
        except HTTPException:
            errors.append(pid)
        except Exception as e:
            logger.warning(f"Error deleting product {pid}: {e}")
            errors.append(pid)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "product.bulk_delete", user_id=user.id, store_id=store.id,
        resource_type="product", resource_id=None,
        details={"count": deleted_count, "names": deleted_names[:20]},
        ip_address=ip, user_agent=user_agent,
    )

    return {
        "success": True,
        "deleted_count": deleted_count,
        "errors": errors,
    }


@router.post("/ai-prefill")
def ai_prefill(
    data: AIPrefillRequest,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """
    Genera información completa de un producto usando IA (GPT-4o + Pexels).
    Devuelve todos los campos del formulario listos para rellenar.
    """
    try:
        result = ai_prefill_product(db, store.id, data.description)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("ai-prefill failed")
        raise HTTPException(status_code=500, detail=f"Error al generar producto: {str(e)}")


def _to_list_response(p) -> ProductListResponse:
    return ProductListResponse(
        id=p.id,
        name=p.name,
        slug=p.slug,
        price=p.price,
        status=getattr(p, "status", "active"),
        stock_quantity=p.stock_quantity if not p.has_variants else sum(v.stock_quantity for v in (p.variants or [])),
        category_id=p.category_id,
        category_name=p.category.name if p.category else None,
        cover_image_url=getattr(p, "cover_image_url", None) or (p.images[0].url if p.images else None),
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
    )


def _to_detail_response(p) -> ProductResponse:
    total_stock = p.stock_quantity
    if p.has_variants and p.variants:
        total_stock = sum(v.stock_quantity for v in p.variants)
    return ProductResponse(
        id=p.id,
        store_id=p.store_id,
        category_id=p.category_id,
        name=p.name,
        slug=p.slug,
        short_description=getattr(p, "short_description", None),
        description=p.description,
        sku=p.sku,
        price=p.price,
        compare_at_price=p.compare_at_price,
        cost=p.cost,
        status=getattr(p, "status", "active"),
        product_type=getattr(p, "product_type", "simple"),
        has_variants=getattr(p, "has_variants", False),
        is_featured=getattr(p, "is_featured", False),
        is_active=p.is_active,
        is_digital=p.is_digital,
        track_inventory=p.track_inventory,
        stock_quantity=p.stock_quantity,
        allow_backorder=getattr(p, "allow_backorder", False),
        cover_image_url=getattr(p, "cover_image_url", None),
        seo_title=getattr(p, "seo_title", None),
        seo_description=getattr(p, "seo_description", None),
        variants=[ProductVariantResponse.model_validate(v) for v in (p.variants or [])],
        images=[ProductImageResponse(id=i.id, url=i.url, alt_text=i.alt_text, sort_order=i.sort_order, is_cover=getattr(i, "is_cover", False)) for i in (p.images or [])],
        category=CategorySummary(id=c.id, name=c.name, slug=c.slug) if (c := p.category) else None,
        total_stock=total_stock,
    )


@router.get("", response_model=PaginatedProductResponse)
def list_store_products(
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
    search: str | None = Query(None),
    status: str | None = Query(None),
    category_id: str | None = Query(None),
    sort: str = Query("updated_at"),
    order: str = Query("desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
):
    """Lista productos de la tienda con filtros y paginación."""
    items, total = list_products(db, store.id, search, status, category_id, sort, order, skip, limit)
    return PaginatedProductResponse(
        items=[_to_list_response(p) for p in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=ProductResponse)
def create(
    data: ProductCreate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Crea producto."""
    product = create_product(db, store.id, data)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "product.create", user_id=user.id, store_id=store.id,
        resource_type="product", resource_id=product.id,
        details={"name": product.name},
        ip_address=ip, user_agent=user_agent,
    )

    return _to_detail_response(product)


@router.get("/{product_id}", response_model=ProductResponse)
def get(
    product_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Obtiene producto por ID."""
    product = get_product(db, product_id, store.id)
    return _to_detail_response(product)


@router.patch("/{product_id}", response_model=ProductResponse)
def update(
    product_id: str,
    data: ProductUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza producto."""
    product = update_product(db, product_id, store.id, data)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "product.update", user_id=user.id, store_id=store.id,
        resource_type="product", resource_id=product.id,
        details={"name": product.name},
        ip_address=ip, user_agent=user_agent,
    )

    return _to_detail_response(product)


@router.delete("/{product_id}")
def delete(
    product_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina producto."""
    product = get_product(db, product_id, store.id)
    delete_product(db, product_id, store.id)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "product.delete", user_id=user.id, store_id=store.id,
        resource_type="product", resource_id=product_id,
        details={"name": product.name},
        ip_address=ip, user_agent=user_agent,
    )
    return {"success": True}


@router.post("/{product_id}/duplicate", response_model=ProductResponse)
def duplicate(
    product_id: str,
    request: Request,
    new_slug: str = Query(..., description="Slug para el producto duplicado"),
    user: User = Depends(get_current_user),
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Duplica producto con nuevo slug."""
    product = duplicate_product(db, product_id, store.id, new_slug)

    ip, user_agent = get_client_info(request)
    log_action(
        db, "product.duplicate", user_id=user.id, store_id=store.id,
        resource_type="product", resource_id=product.id,
        details={"name": product.name, "source_id": product_id},
        ip_address=ip, user_agent=user_agent,
    )
    return _to_detail_response(product)


@router.post("/{product_id}/variants", response_model=ProductVariantResponse)
def create_variant(
    product_id: str,
    data: VariantCreateBody,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Añade variante a producto."""
    variant = add_product_variant(db, product_id, store.id, data)
    return ProductVariantResponse.model_validate(variant)


@router.patch("/{product_id}/variants/{variant_id}", response_model=ProductVariantResponse)
def update_variant(
    product_id: str,
    variant_id: str,
    data: VariantUpdateBody,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Actualiza variante."""
    update_data = data.model_dump(exclude_unset=True)
    variant = update_product_variant(db, product_id, variant_id, store.id, update_data)
    return ProductVariantResponse.model_validate(variant)


@router.delete("/{product_id}/variants/{variant_id}")
def delete_variant(
    product_id: str,
    variant_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina variante."""
    remove_product_variant(db, product_id, variant_id, store.id)
    return {"success": True}


@router.post("/{product_id}/images", response_model=ProductImageResponse)
def create_image(
    product_id: str,
    data: ImageCreateBody,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Añade imagen a producto."""
    img = add_product_image(db, product_id, store.id, data)
    return ProductImageResponse(id=img.id, url=img.url, alt_text=img.alt_text, sort_order=img.sort_order, is_cover=getattr(img, "is_cover", False))


@router.patch("/{product_id}/images/reorder")
def reorder_images(
    product_id: str,
    data: ImageReorderBody,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Reordena imágenes del producto."""
    reorder_product_images(db, product_id, store.id, data.image_ids)
    return {"success": True}


@router.delete("/{product_id}/images/{image_id}")
def delete_image(
    product_id: str,
    image_id: str,
    store: Store = Depends(get_current_store),
    db: Session = Depends(get_db),
):
    """Elimina imagen del producto."""
    remove_product_image(db, product_id, image_id, store.id)
    return {"success": True}
