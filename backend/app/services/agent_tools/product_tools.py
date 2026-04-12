"""
Tools de productos: búsqueda, detalle, disponibilidad, recomendación.
"""

import json
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.product import Product, ProductVariant
from app.models.sales_session import SalesSession


def tool_product_search(db: Session, session: SalesSession, **params) -> str:
    """Busca productos por nombre o categoría en el catálogo de la tienda."""
    query = params.get("query", "")
    limit = params.get("limit", 5)

    products = db.query(Product).filter(
        Product.store_id == session.store_id,
        Product.is_active == True,
        Product.status == "active",
        or_(
            Product.name.ilike(f"%{query}%"),
            Product.description.ilike(f"%{query}%"),
            Product.short_description.ilike(f"%{query}%"),
        ),
    ).limit(limit).all()

    results = []
    for p in products:
        results.append({
            "id": p.id,
            "name": p.name,
            "price": str(p.price),
            "description": p.short_description or (p.description or "")[:150],
            "stock": p.stock_quantity,
            "has_variants": p.has_variants,
            "cover_image": getattr(p, "cover_image_url", None) or (p.images[0].url if p.images else None),
        })

    nb = session.get_notebook()
    if query:
        existing = nb["interest"].get("categories", [])
        if query not in existing:
            existing.append(query)
        nb["interest"]["categories"] = existing
    session.set_notebook(nb)

    return json.dumps({"products": results, "count": len(results)}, ensure_ascii=False)


def tool_product_detail(db: Session, session: SalesSession, **params) -> str:
    """Obtiene detalle completo de un producto por ID."""
    product_id = params.get("product_id", "")

    product = db.query(Product).filter(
        Product.id == product_id,
        Product.store_id == session.store_id,
        Product.is_active == True,
    ).first()

    if not product:
        return json.dumps({"error": "Producto no encontrado"})

    variants = []
    for v in (product.variants or []):
        if v.is_active:
            variants.append({
                "id": v.id,
                "name": v.name,
                "price": str(v.price),
                "stock": v.stock_quantity,
                "sku": v.sku,
            })

    result = {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": str(product.price),
        "compare_at_price": str(product.compare_at_price) if product.compare_at_price else None,
        "stock": product.stock_quantity,
        "sku": product.sku,
        "has_variants": product.has_variants,
        "variants": variants,
        "images": [{"url": i.url, "alt": i.alt_text} for i in (product.images or [])],
    }

    nb = session.get_notebook()
    mentioned = nb["interest"].get("products_mentioned", [])
    if product.name not in mentioned:
        mentioned.append(product.name)
    nb["interest"]["products_mentioned"] = mentioned
    session.set_notebook(nb)

    return json.dumps(result, ensure_ascii=False)


def tool_check_availability(db: Session, session: SalesSession, **params) -> str:
    """Verifica stock de un producto o variante."""
    product_id = params.get("product_id", "")
    variant_id = params.get("variant_id")
    quantity = params.get("quantity", 1)

    if variant_id:
        variant = db.query(ProductVariant).filter(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
        ).first()
        if not variant:
            return json.dumps({"available": False, "reason": "Variante no encontrada"})
        available = variant.stock_quantity >= quantity or not variant.track_inventory
        result = {
            "available": available,
            "product_id": product_id,
            "variant_id": variant_id,
            "variant_name": variant.name,
            "stock": variant.stock_quantity,
            "requested": quantity,
        }
    else:
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.store_id == session.store_id,
        ).first()
        if not product:
            return json.dumps({"available": False, "reason": "Producto no encontrado"})
        available = product.stock_quantity >= quantity or product.allow_backorder or not product.track_inventory
        result = {
            "available": available,
            "product_id": product_id,
            "product_name": product.name,
            "stock": product.stock_quantity,
            "requested": quantity,
            "allow_backorder": product.allow_backorder,
        }

    nb = session.get_notebook()
    checked = nb["availability"].get("checked_products", [])
    checked.append({"product_id": product_id, "available": available})
    nb["availability"]["checked_products"] = checked
    nb["availability"]["all_available"] = all(c["available"] for c in checked)
    session.set_notebook(nb)

    return json.dumps(result, ensure_ascii=False)


def tool_recommend_product(db: Session, session: SalesSession, **params) -> str:
    """Recomienda productos según el contexto del notebook."""
    category = params.get("category", "")
    max_price = params.get("max_price")
    limit = params.get("limit", 3)

    query = db.query(Product).filter(
        Product.store_id == session.store_id,
        Product.is_active == True,
        Product.status == "active",
    )
    if category:
        query = query.filter(Product.name.ilike(f"%{category}%"))
    if max_price:
        query = query.filter(Product.price <= max_price)

    products = query.order_by(Product.is_featured.desc()).limit(limit).all()

    results = [{
        "id": p.id,
        "name": p.name,
        "price": str(p.price),
        "description": (p.short_description or "")[:100],
    } for p in products]

    nb = session.get_notebook()
    nb["recommendation"]["products"] = [r["name"] for r in results]
    nb["recommendation"]["reasoning"] = params.get("reasoning", "Basado en preferencias del cliente")
    session.set_notebook(nb)

    return json.dumps({"recommendations": results}, ensure_ascii=False)


PRODUCT_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "product_search",
            "description": "Buscar productos en el catálogo de la tienda por nombre, descripción o categoría",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Término de búsqueda"},
                    "limit": {"type": "integer", "description": "Máximo de resultados", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "product_detail",
            "description": "Obtener detalle completo de un producto por su ID",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "ID del producto"},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Verificar disponibilidad y stock de un producto o variante",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "ID del producto"},
                    "variant_id": {"type": "string", "description": "ID de la variante (opcional)"},
                    "quantity": {"type": "integer", "description": "Cantidad requerida", "default": 1},
                },
                "required": ["product_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_product",
            "description": "Recomendar productos basado en preferencias del cliente",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Categoría o tipo de producto"},
                    "max_price": {"type": "number", "description": "Precio máximo"},
                    "limit": {"type": "integer", "description": "Máximo de recomendaciones", "default": 3},
                    "reasoning": {"type": "string", "description": "Razón de la recomendación"},
                },
                "required": [],
            },
        },
    },
]
