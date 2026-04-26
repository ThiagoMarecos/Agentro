"""
Tools de productos: búsqueda, detalle, disponibilidad, recomendación.
"""

import base64
import json
import logging
import re
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.models.product import Product, ProductVariant, Category
from app.models.sales_session import SalesSession

logger = logging.getLogger(__name__)

# Directorio de uploads: backend/uploads/ → /app/uploads/ en Docker
# product_tools.py está en backend/app/services/agent_tools/
_UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"


# Palabras vacías a ignorar en la búsqueda
_STOPWORDS = {
    "de", "del", "la", "el", "los", "las", "un", "una", "unos", "unas",
    "para", "con", "sin", "y", "o", "u", "en", "que", "es", "son",
    "tienen", "tiene", "tienes", "hay", "algun", "alguna", "algún",
    "alguno", "algunos", "algunas", "me", "te", "se", "mi", "mis",
    "tu", "tus", "su", "sus", "lo", "le", "les", "ver", "quiero",
    "necesito", "busco", "busca", "ropa", "producto", "productos",
    "articulo", "articulos", "artículo", "artículos",
    "tenes", "tenés", "tendrian", "tendrías", "podes", "podés",
    "comprar", "venden", "vende", "tienen", "queria", "quería",
}

# Sinónimos: cuando el cliente menciona X, buscamos también Y, Z.
# Pensado para LATAM + España + inglés. Lista mínima — extensible desde DB futuro.
_SYNONYMS: dict[str, list[str]] = {
    "remera": ["playera", "camiseta", "tee", "tshirt", "polera"],
    "remeras": ["playeras", "camisetas", "tees", "tshirts", "poleras"],
    "campera": ["chaqueta", "jacket", "abrigo"],
    "camperas": ["chaquetas", "jackets", "abrigos"],
    "buzo": ["sudadera", "hoodie", "sweater", "sueter", "canguro"],
    "buzos": ["sudaderas", "hoodies", "sweaters", "canguros"],
    "zapatilla": ["zapatillas", "tenis", "sneaker", "sneakers", "championes"],
    "zapatillas": ["tenis", "sneakers", "championes"],
    "pantalon": ["pantalón", "pant", "pants", "jean", "jeans"],
    "pantalones": ["jeans", "pants"],
    "talle": ["talla", "size", "medida"],
    "talles": ["tallas", "sizes", "medidas"],
    "color": ["colour", "tono"],
    "negro": ["negra", "black", "negros", "negras"],
    "blanco": ["blanca", "white", "blancos", "blancas"],
    "rojo": ["roja", "red", "rojos", "rojas"],
    "azul": ["blue", "azules"],
    "verde": ["green", "verdes"],
    "gorra": ["gorras", "cap", "caps", "visera"],
    "mochila": ["mochilas", "backpack", "bolso"],
}


def _normalize(text: str) -> str:
    """Baja a minúsculas y quita tildes/diacríticos."""
    import unicodedata
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode("ascii")


def _tokenize(text: str) -> list[str]:
    """Extrae palabras significativas para búsqueda."""
    if not text:
        return []
    norm = _normalize(text)
    words = re.findall(r"[a-z0-9]+", norm)
    return [w for w in words if len(w) >= 3 and w not in _STOPWORDS]


def _search_patterns(tokens: list[str]) -> list[str]:
    """
    Genera patrones de búsqueda para cada token.
    Para cada token incluye:
      - El token completo (matching exacto y como substring)
      - Un prefijo de 6 chars para cross-language matching
        (ej. "compresion" → "compres" matchea "compression" en inglés)
      - Sinónimos del diccionario _SYNONYMS (ej. "remera" → "playera", "camiseta")
    """
    seen: set[str] = set()
    patterns: list[str] = []

    def _add(p: str | None):
        if p and len(p) >= 3 and p not in seen:
            seen.add(p)
            patterns.append(p)

    for token in tokens:
        _add(token)
        if len(token) > 7:
            _add(token[:6])
        for syn in _SYNONYMS.get(token, []):
            _add(_normalize(syn))

    return patterns


def tool_product_search(db: Session, session: SalesSession, **params) -> str:
    """
    Busca productos en el catálogo. Tokeniza la query y busca cada palabra
    en nombre, descripción y nombre de categoría. Retorna productos que
    matchean al menos una palabra, ordenados por relevancia.
    """
    query = (params.get("query") or "").strip()
    limit = params.get("limit", 5)

    if not query:
        return json.dumps({"products": [], "count": 0, "query": ""}, ensure_ascii=False)

    tokens = _tokenize(query)
    if not tokens:
        tokens = [_normalize(query)]

    # Patrones de búsqueda: token completo + prefijo corto para matching cross-idioma
    # Ej: "compresion" → busca también "compres" que matchea "compression" en inglés
    patterns = _search_patterns(tokens)

    base_filters = [
        Product.store_id == session.store_id,
        Product.is_active == True,
        Product.status == "active",
    ]

    pattern_conditions = []
    for pat in patterns:
        like = f"%{pat}%"
        pattern_conditions.append(or_(
            Product.name.ilike(like),
            Product.description.ilike(like),
            Product.short_description.ilike(like),
            Category.name.ilike(like),
        ))

    products = db.query(Product).outerjoin(
        Category, Product.category_id == Category.id
    ).filter(
        and_(*base_filters, or_(*pattern_conditions))
    ).limit(limit * 3).all()

    # Rankear: cuántos tokens originales matchean el texto del producto
    def score(p: Product) -> int:
        combined = _normalize(" ".join([
            p.name or "",
            p.short_description or "",
            (p.description or "")[:300],
            (p.category.name if p.category else ""),
        ]))
        # contar tokens originales + prefijos
        return sum(1 for pat in patterns if pat in combined)

    ranked = sorted(products, key=score, reverse=True)[:limit]
    logger.info(
        f"[search] query={query!r} tokens={tokens} patterns={patterns} "
        f"raw_hits={len(products)} returned={len(ranked)}"
    )

    results = []
    for p in ranked:
        results.append({
            "id": p.id,
            "name": p.name,
            "price": str(p.price),
            "description": p.short_description or (p.description or "")[:150],
            "category": p.category.name if p.category else None,
            "has_variants": p.has_variants,
            "cover_image": getattr(p, "cover_image_url", None) or (p.images[0].url if p.images else None),
            # stock NO incluido aquí — usar check_availability para disponibilidad real
        })

    nb = session.get_notebook()
    if query:
        existing = nb["interest"].get("categories", [])
        if query not in existing:
            existing.append(query)
        nb["interest"]["categories"] = existing
    session.set_notebook(nb)

    return json.dumps({
        "products": results,
        "count": len(results),
        "query": query,
        "matched_tokens": tokens,
    }, ensure_ascii=False)


def tool_list_categories(db: Session, session: SalesSession, **params) -> str:
    """
    Lista todas las categorías y tipos de productos disponibles en la tienda.
    Útil cuando el cliente pregunta qué hay disponible o el agente necesita
    orientarse antes de buscar.
    """
    categories = db.query(Category).filter(
        Category.store_id == session.store_id,
        Category.is_active == True,
    ).order_by(Category.sort_order.asc(), Category.name.asc()).all()

    # Contar productos activos por categoría
    cat_data = []
    for c in categories:
        count = db.query(func.count(Product.id)).filter(
            Product.category_id == c.id,
            Product.is_active == True,
            Product.status == "active",
        ).scalar() or 0
        if count > 0:
            cat_data.append({
                "id": c.id,
                "name": c.name,
                "description": c.description or "",
                "product_count": count,
            })

    # También incluir productos sin categoría
    uncategorized = db.query(func.count(Product.id)).filter(
        Product.store_id == session.store_id,
        Product.category_id.is_(None),
        Product.is_active == True,
        Product.status == "active",
    ).scalar() or 0

    total_products = db.query(func.count(Product.id)).filter(
        Product.store_id == session.store_id,
        Product.is_active == True,
        Product.status == "active",
    ).scalar() or 0

    return json.dumps({
        "categories": cat_data,
        "uncategorized_count": uncategorized,
        "total_products": total_products,
    }, ensure_ascii=False)


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

    # ── Información de origen / proveedor ──
    # Visible solo para el agente. NO repetirla literalmente al cliente
    # salvo que pregunte expresamente por origen, garantía o tiempos.
    origin_label_map = {
        "external_supplier": "Proveedor externo",
        "own_manufacturing": "Fabricación propia",
        "dropshipping": "Dropshipping",
        "imported": "Importado",
    }
    origin_type = getattr(product, "origin_type", None) or "external_supplier"
    supplier_obj = getattr(product, "supplier", None)
    supplier_info = None
    if supplier_obj:
        supplier_info = {
            "id": supplier_obj.id,
            "name": supplier_obj.name,
            "country": getattr(supplier_obj, "country", None),
        }

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
        # Contexto interno
        "_internal": {
            "origin_type": origin_type,
            "origin_label": origin_label_map.get(origin_type, origin_type),
            "lead_time_days": getattr(product, "lead_time_days", None),
            "supplier": supplier_info,
            "internal_notes": getattr(product, "internal_notes", None),
            "cost": str(product.cost) if product.cost else None,
        },
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
            logger.warning(f"[stock] variant_not_found product_id={product_id} variant_id={variant_id}")
            return json.dumps({
                "available": None,  # null = "no pude determinar", NO false
                "reason": "Variante no encontrada — verificá que el variant_id sea un UUID exacto del bloque DATOS DISPONIBLES",
                "id_provided": variant_id,
                "hint": "NO le digas al cliente 'no hay stock'. Re-mirá el bloque DATOS DISPONIBLES y copiá el UUID exacto del producto/variante.",
            })
        available = variant.stock_quantity >= quantity or not variant.track_inventory
        logger.info(
            f"[stock] variant product_id={product_id} variant={variant.name!r} "
            f"stock={variant.stock_quantity} requested={quantity} "
            f"track_inventory={variant.track_inventory} available={available}"
        )
        result = {
            "available": available,
            "product_id": product_id,
            "variant_id": variant_id,
            "variant_name": variant.name,
            "stock": variant.stock_quantity,
            "requested": quantity,
            "track_inventory": variant.track_inventory,
        }
    else:
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.store_id == session.store_id,
        ).first()
        if not product:
            logger.warning(f"[stock] product_not_found product_id={product_id} store_id={session.store_id}")
            return json.dumps({
                "available": None,  # null = "no pude determinar", NO false
                "reason": (
                    "Producto no encontrado — el ID que pasaste no es un UUID válido en la DB. "
                    "Probablemente copiaste el slug, el SKU o el nombre del producto en vez del UUID."
                ),
                "id_provided": product_id,
                "hint": (
                    "NO le digas al cliente 'no hay stock' — ese fue UN ERROR DE TU LADO al copiar el ID. "
                    "Re-leé el bloque DATOS DISPONIBLES y copiá el UUID exacto que aparece en la línea "
                    "'UUID (copiar literal si llamás tools): `8b78bd11-...`'. "
                    "Si el producto YA está en DATOS DISPONIBLES con su stock, ni siquiera necesitás "
                    "llamar esta tool — usá el stock que ya viene en el contexto."
                ),
            })
        available = product.stock_quantity >= quantity or product.allow_backorder or not product.track_inventory
        logger.info(
            f"[stock] product id={product_id} name={product.name!r} "
            f"stock={product.stock_quantity} requested={quantity} "
            f"track_inventory={product.track_inventory} backorder={product.allow_backorder} "
            f"available={available}"
        )
        result = {
            "available": available,
            "product_id": product_id,
            "product_name": product.name,
            "stock": product.stock_quantity,
            "requested": quantity,
            "allow_backorder": product.allow_backorder,
            "track_inventory": product.track_inventory,
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


def tool_send_product_image(db: Session, session: SalesSession, **params) -> str:
    """
    Programa el envío de la foto de un producto al cliente por WhatsApp.
    Las imágenes se envían después del mensaje de texto.
    """
    product_id = params.get("product_id", "")
    caption = params.get("caption", "")
    pending_media: list | None = params.get("_pending_media")

    product = db.query(Product).filter(
        Product.id == product_id,
        Product.store_id == session.store_id,
        Product.is_active == True,
    ).first()

    if not product:
        return json.dumps({"sent": False, "reason": "Producto no encontrado"})

    images = product.images or []
    if not images:
        return json.dumps({"sent": False, "reason": "El producto no tiene imágenes cargadas"})

    # Tomar la imagen de portada o la primera
    cover = next((i for i in images if i.is_cover), images[0])
    url = cover.url

    # Leer el archivo del disco y codificar en base64.
    # Evolution API acepta base64 directamente → no depende de URLs públicas.
    b64_data: str | None = None
    if url.startswith("/uploads/"):
        try:
            rel_path = url[len("/uploads/"):]  # quitar el prefijo "/uploads/"
            file_path = _UPLOADS_DIR / rel_path
            if file_path.exists() and file_path.is_file():
                b64_data = base64.b64encode(file_path.read_bytes()).decode()
                logger.info(f"Image encoded as base64: {file_path} ({len(b64_data)} chars)")
            else:
                logger.warning(f"Image file not found on disk: {file_path}")
        except Exception as e:
            logger.warning(f"Could not encode image to base64: {e}")

    # Fallback: si no se pudo leer del disco, intentar con URL pública
    public_url = url
    if url.startswith("/") and not b64_data:
        from app.config import get_settings
        settings = get_settings()
        public_url = f"{settings.backend_url}{url}"

    if pending_media is not None:
        pending_media.append({
            "type": "image",
            "url": public_url,
            "b64": b64_data,
            "caption": caption or product.name,
        })

    return json.dumps({
        "sent": True,
        "product": product.name,
        "image_url": public_url,
        "caption": caption or product.name,
        "base64_available": b64_data is not None,
    }, ensure_ascii=False)


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
    {
        "type": "function",
        "function": {
            "name": "list_categories",
            "description": (
                "Listar todas las categorías de productos disponibles en la tienda con la cantidad de productos en cada una. "
                "USALA al inicio de la conversación para conocer el catálogo, antes de buscar nada. "
                "También úsala cuando el cliente pregunte 'qué venden' o 'qué tienen'."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_product_image",
            "description": (
                "Enviar la foto de un producto al cliente por WhatsApp. "
                "Usá esta tool cuando el cliente pida ver una foto, o cuando presentes un producto por primera vez. "
                "La imagen se envía justo después de tu mensaje de texto."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "ID del producto cuya imagen enviar"},
                    "caption": {"type": "string", "description": "Texto que acompaña la imagen (opcional, por defecto el nombre del producto)"},
                },
                "required": ["product_id"],
            },
        },
    },
]
