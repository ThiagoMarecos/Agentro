"""
Repositorio de productos.
"""

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.product import Product, ProductVariant, ProductImage
from app.schemas.product import ProductCreate, ProductUpdate, ProductVariantCreate, ProductImageCreate


def get_by_id(db: Session, product_id: str, store_id: str) -> Product | None:
    return db.query(Product).filter(
        Product.id == product_id,
        Product.store_id == store_id,
    ).first()


def get_by_slug(db: Session, slug: str, store_id: str) -> Product | None:
    return db.query(Product).filter(
        Product.slug == slug.lower().strip(),
        Product.store_id == store_id,
    ).first()


def list_by_store(
    db: Session,
    store_id: str,
    search: str | None = None,
    status: str | None = None,
    category_id: str | None = None,
    sort: str = "updated_at",
    order: str = "desc",
    skip: int = 0,
    limit: int = 50,
) -> list[Product]:
    q = db.query(Product).filter(Product.store_id == store_id)
    if search:
        q = q.filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )
    if status:
        q = q.filter(Product.status == status)
    if category_id:
        q = q.filter(Product.category_id == category_id)
    order_col = getattr(Product, sort, Product.updated_at)
    if order == "desc":
        q = q.order_by(order_col.desc().nullslast())
    else:
        q = q.order_by(order_col.asc().nullsfirst())
    return q.offset(skip).limit(limit).all()


def count_by_store(
    db: Session,
    store_id: str,
    search: str | None = None,
    status: str | None = None,
    category_id: str | None = None,
) -> int:
    q = db.query(func.count(Product.id)).filter(Product.store_id == store_id)
    if search:
        q = q.filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )
    if status:
        q = q.filter(Product.status == status)
    if category_id:
        q = q.filter(Product.category_id == category_id)
    return q.scalar() or 0


def create(db: Session, store_id: str, data: ProductCreate) -> Product:
    cover_url = None
    if data.images:
        cover_img = next((i for i in data.images if i.is_cover), None)
        if cover_img:
            cover_url = cover_img.url
        elif data.images:
            cover_url = data.images[0].url

    product = Product(
        store_id=store_id,
        category_id=data.category_id,
        name=data.name,
        slug=data.slug,
        short_description=data.short_description,
        description=data.description,
        sku=data.sku,
        price=data.price,
        compare_at_price=data.compare_at_price,
        cost=data.cost,
        status=data.status,
        product_type=data.product_type,
        has_variants=data.has_variants,
        is_featured=data.is_featured,
        cover_image_url=cover_url,
        is_active=data.is_active,
        is_digital=data.is_digital,
        track_inventory=data.track_inventory,
        stock_quantity=data.stock_quantity,
        allow_backorder=data.allow_backorder,
        seo_title=data.seo_title,
        seo_description=data.seo_description,
    )
    db.add(product)
    db.flush()

    for v in data.variants:
        variant = ProductVariant(
            product_id=product.id,
            store_id=store_id,
            name=v.name,
            sku=v.sku,
            price=v.price,
            compare_at_price=v.compare_at_price,
            stock_quantity=v.stock_quantity,
            track_inventory=v.track_inventory,
            is_default=v.is_default,
            option_values=v.option_values,
        )
        db.add(variant)

    for i, img in enumerate(data.images):
        pi = ProductImage(
            product_id=product.id,
            store_id=store_id,
            url=img.url,
            alt_text=img.alt_text,
            sort_order=img.sort_order or i,
            is_cover=img.is_cover,
        )
        db.add(pi)

    db.commit()
    db.refresh(product)
    return product


def update(db: Session, product: Product, data: ProductUpdate) -> Product:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


def delete(db: Session, product: Product) -> None:
    db.delete(product)
    db.commit()


def duplicate(db: Session, product: Product, new_slug: str) -> Product:
    new_product = Product(
        store_id=product.store_id,
        category_id=product.category_id,
        name=f"{product.name} (copia)",
        slug=new_slug,
        short_description=product.short_description,
        description=product.description,
        sku=product.sku,
        price=product.price,
        compare_at_price=product.compare_at_price,
        cost=product.cost,
        status="draft",
        product_type=product.product_type,
        has_variants=product.has_variants,
        is_featured=product.is_featured,
        cover_image_url=product.cover_image_url,
        is_active=product.is_active,
        is_digital=product.is_digital,
        track_inventory=product.track_inventory,
        stock_quantity=product.stock_quantity,
        allow_backorder=product.allow_backorder,
        seo_title=product.seo_title,
        seo_description=product.seo_description,
    )
    db.add(new_product)
    db.flush()

    for v in product.variants:
        nv = ProductVariant(
            product_id=new_product.id,
            store_id=product.store_id,
            name=v.name,
            sku=v.sku,
            price=v.price,
            compare_at_price=v.compare_at_price,
            stock_quantity=v.stock_quantity,
            track_inventory=v.track_inventory,
            is_default=v.is_default,
            is_active=v.is_active,
            option_values=v.option_values,
        )
        db.add(nv)

    for img in product.images:
        ni = ProductImage(
            product_id=new_product.id,
            store_id=product.store_id,
            url=img.url,
            alt_text=img.alt_text,
            sort_order=img.sort_order,
            is_cover=img.is_cover,
        )
        db.add(ni)

    db.commit()
    db.refresh(new_product)
    return new_product


def create_variant(db: Session, product: Product, data: ProductVariantCreate) -> ProductVariant:
    v = ProductVariant(
        product_id=product.id,
        store_id=product.store_id,
        name=data.name,
        sku=data.sku,
        price=data.price,
        compare_at_price=data.compare_at_price,
        stock_quantity=data.stock_quantity,
        track_inventory=data.track_inventory,
        is_default=data.is_default,
        option_values=data.option_values,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def update_variant(db: Session, variant: ProductVariant, data: dict) -> ProductVariant:
    for key, value in data.items():
        setattr(variant, key, value)
    db.commit()
    db.refresh(variant)
    return variant


def delete_variant(db: Session, variant: ProductVariant) -> None:
    db.delete(variant)
    db.commit()


def add_image(db: Session, product: Product, data: ProductImageCreate) -> ProductImage:
    img = ProductImage(
        product_id=product.id,
        store_id=product.store_id,
        url=data.url,
        alt_text=data.alt_text,
        sort_order=data.sort_order,
        is_cover=data.is_cover,
    )
    db.add(img)
    db.flush()
    if data.is_cover:
        product.cover_image_url = data.url
        for other in db.query(ProductImage).filter(ProductImage.product_id == product.id).all():
            if other.id != img.id:
                other.is_cover = False
    db.commit()
    db.refresh(img)
    return img


def reorder_images(db: Session, product: Product, image_ids: list[str]) -> None:
    for i, img_id in enumerate(image_ids):
        img = next((x for x in product.images if x.id == img_id), None)
        if img:
            img.sort_order = i
    db.commit()


def delete_image(db: Session, product: Product, image_id: str) -> None:
    img = next((x for x in product.images if x.id == image_id), None)
    if img:
        if img.is_cover and product.images:
            next_img = next((x for x in product.images if x.id != image_id), None)
            if next_img:
                next_img.is_cover = True
                product.cover_image_url = next_img.url
            else:
                product.cover_image_url = None
        db.delete(img)
        db.commit()


def get_variant_by_id(db: Session, variant_id: str, store_id: str) -> ProductVariant | None:
    return db.query(ProductVariant).filter(
        ProductVariant.id == variant_id,
        ProductVariant.store_id == store_id,
    ).first()
