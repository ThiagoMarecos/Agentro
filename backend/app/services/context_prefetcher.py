"""
Context Prefetcher — segunda mitad de la arquitectura "Context-First".

Recibe un Intent del intent_extractor y consulta la DB DETERMINÍSTICAMENTE
para traer todo lo que el LLM va a necesitar para responder.

El resultado se inyecta al prompt como bloque "DATOS DISPONIBLES" — el LLM
ya no decide qué consultar, los datos están en su contexto.

Beneficios:
  - 100% determinista (los datos SIEMPRE están si existen en DB)
  - 1 sola llamada al LLM por turno (vs 2-4 con tool calling)
  - Imposible que el LLM diga "no hay stock" si el contexto dice "stock: 12"
  - Costo y latencia más bajos
"""

import logging
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.product import Product, ProductVariant, Category
from app.models.sales_session import SalesSession
from app.services.intent_extractor import Intent

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════════
#  Tipos del resultado
# ════════════════════════════════════════════════════════════════════

@dataclass
class PrefetchedProduct:
    """Producto matcheado con TODA la info que el LLM necesita."""
    id: str
    name: str
    price: Decimal
    compare_at_price: Decimal | None
    short_description: str | None
    category_name: str | None
    has_variants: bool

    # Stock real (resuelto en este momento contra DB)
    stock_quantity: int
    track_inventory: bool
    allow_backorder: bool
    is_available: bool  # = stock>0 o backorder o no track

    # Origen / proveedor (interno)
    origin_type: str | None
    lead_time_days: int | None
    internal_notes: str | None  # NO se le muestra al cliente literal

    # Variantes resumidas (talles, colores)
    variants: list[dict] = field(default_factory=list)

    # Imagen para enviar
    cover_image_url: str | None = None


@dataclass
class PrefetchedContext:
    """Todo lo que el prefetcher devolvió al runtime para inyectar al prompt."""

    # Productos que matchean el intent (top N por query)
    matched_products: list[PrefetchedProduct] = field(default_factory=list)

    # Resumen del catálogo (categorías + cuántos productos en cada una)
    categories_summary: list[dict] = field(default_factory=list)
    total_products: int = 0

    # Descuentos vigentes (productos con compare_at_price > price)
    active_discounts: list[dict] = field(default_factory=list)

    # Flag: el cliente pidió hablar con humano
    customer_wants_human: bool = False

    # Flag: el cliente expresó intent de avanzar (comprar / cerrar)
    customer_wants_to_proceed: bool = False

    # Datos personales detectados en el último mensaje (para que el LLM los confirme/guarde)
    detected_personal_data: dict = field(default_factory=dict)

    def is_empty(self) -> bool:
        return not (
            self.matched_products
            or self.categories_summary
            or self.active_discounts
            or self.customer_wants_human
            or self.customer_wants_to_proceed
            or self.detected_personal_data
        )


# ════════════════════════════════════════════════════════════════════
#  Helpers de búsqueda
# ════════════════════════════════════════════════════════════════════

# Reusamos los mismos tokenizers/sinónimos que ya están en product_tools.
# No duplicamos lógica para mantener consistencia entre prefetch y tool fallback.

def _build_product_filters(query: str) -> tuple[list, list]:
    """
    Genera condiciones SQL para buscar el producto. Reusa la lógica de
    `product_tools._tokenize` + `_search_patterns` (sinónimos).
    """
    from app.services.agent_tools.product_tools import _tokenize, _search_patterns

    tokens = _tokenize(query) or [query.lower()]
    patterns = _search_patterns(tokens)

    pattern_conditions = []
    for pat in patterns:
        like = f"%{pat}%"
        pattern_conditions.append(or_(
            Product.name.ilike(like),
            Product.description.ilike(like),
            Product.short_description.ilike(like),
            Category.name.ilike(like),
        ))

    return pattern_conditions, patterns


def _resolve_availability(product: Product, requested: int = 1) -> bool:
    """
    True si hay stock real (>= requested), o backorder, o no se trackea
    inventario para este producto.
    """
    if not product.track_inventory:
        return True
    if product.allow_backorder:
        return True
    return (product.stock_quantity or 0) >= requested


def _to_prefetched_product(product: Product) -> PrefetchedProduct:
    """Convierte un modelo Product a PrefetchedProduct."""
    variants = []
    for v in (product.variants or []):
        if not v.is_active:
            continue
        variants.append({
            "id": v.id,
            "name": v.name,
            "stock": v.stock_quantity or 0,
            "track_inventory": getattr(v, "track_inventory", True),
            "available": (v.stock_quantity or 0) > 0 or not getattr(v, "track_inventory", True),
        })

    cover_url = getattr(product, "cover_image_url", None) or (
        product.images[0].url if product.images else None
    )

    return PrefetchedProduct(
        id=product.id,
        name=product.name,
        price=product.price,
        compare_at_price=product.compare_at_price,
        short_description=product.short_description,
        category_name=product.category.name if product.category else None,
        has_variants=product.has_variants or False,
        stock_quantity=product.stock_quantity or 0,
        track_inventory=product.track_inventory or False,
        allow_backorder=product.allow_backorder or False,
        is_available=_resolve_availability(product),
        origin_type=getattr(product, "origin_type", None),
        lead_time_days=getattr(product, "lead_time_days", None),
        internal_notes=getattr(product, "internal_notes", None),
        variants=variants,
        cover_image_url=cover_url,
    )


# ════════════════════════════════════════════════════════════════════
#  Prefetchers individuales
# ════════════════════════════════════════════════════════════════════

def _prefetch_products_for_query(
    db: Session, store_id: str, query: str, limit: int = 3
) -> list[PrefetchedProduct]:
    """Busca productos que matcheen la query y los devuelve hidratados."""
    pattern_conditions, _ = _build_product_filters(query)
    if not pattern_conditions:
        return []

    products = (
        db.query(Product)
        .outerjoin(Category, Product.category_id == Category.id)
        .filter(
            and_(
                Product.store_id == store_id,
                Product.is_active == True,
                Product.status == "active",
                or_(*pattern_conditions),
            )
        )
        .limit(limit)
        .all()
    )

    return [_to_prefetched_product(p) for p in products]


def _prefetch_categories_summary(
    db: Session, store_id: str, limit: int = 8
) -> tuple[list[dict], int]:
    """Resumen del catálogo: top N categorías con su count + total de productos."""
    categories = (
        db.query(Category)
        .filter(Category.store_id == store_id, Category.is_active == True)
        .order_by(Category.sort_order.asc(), Category.name.asc())
        .all()
    )

    summary: list[dict] = []
    for c in categories:
        count = (
            db.query(func.count(Product.id))
            .filter(
                Product.category_id == c.id,
                Product.is_active == True,
                Product.status == "active",
            )
            .scalar()
            or 0
        )
        if count > 0:
            summary.append({"name": c.name, "count": count})

    summary.sort(key=lambda x: x["count"], reverse=True)
    summary = summary[:limit]

    total = (
        db.query(func.count(Product.id))
        .filter(
            Product.store_id == store_id,
            Product.is_active == True,
            Product.status == "active",
        )
        .scalar()
        or 0
    )

    return summary, total


def _prefetch_active_discounts(db: Session, store_id: str, limit: int = 5) -> list[dict]:
    """Productos con descuento vigente (compare_at_price > price)."""
    products = (
        db.query(Product)
        .filter(
            Product.store_id == store_id,
            Product.is_active == True,
            Product.status == "active",
            Product.compare_at_price.isnot(None),
            Product.compare_at_price > 0,
        )
        .limit(limit * 2)
        .all()
    )

    discounts: list[dict] = []
    for p in products:
        if p.compare_at_price and p.price and p.compare_at_price > p.price:
            pct = round(
                ((float(p.compare_at_price) - float(p.price)) / float(p.compare_at_price)) * 100,
                1,
            )
            discounts.append({
                "name": p.name,
                "original": float(p.compare_at_price),
                "now": float(p.price),
                "pct": pct,
            })

    # Ordenamos por % de descuento descendente
    discounts.sort(key=lambda d: d["pct"], reverse=True)
    return discounts[:limit]


# ════════════════════════════════════════════════════════════════════
#  Prefetcher principal
# ════════════════════════════════════════════════════════════════════

def prefetch(
    db: Session,
    session: SalesSession,
    intent: Intent,
) -> PrefetchedContext:
    """
    Dado un Intent, consulta la DB y devuelve TODO lo que el LLM va a
    necesitar para componer la respuesta. La idea es que el prompt ya
    tenga los datos servidos y el LLM no tenga que decidir cuándo
    consultar nada.
    """
    ctx = PrefetchedContext()

    # ── Datos personales detectados en el mensaje del cliente ──
    if intent.detected_phone:
        ctx.detected_personal_data["phone"] = intent.detected_phone
    if intent.detected_email:
        ctx.detected_personal_data["email"] = intent.detected_email
    if intent.detected_address:
        ctx.detected_personal_data["address"] = intent.detected_address

    # ── Flags directos del intent ──
    ctx.customer_wants_human = intent.wants_human
    ctx.customer_wants_to_proceed = intent.wants_to_proceed

    # ── Productos matcheados ──
    seen_product_ids: set[str] = set()
    for query in intent.product_queries:
        products = _prefetch_products_for_query(db, session.store_id, query, limit=3)
        for p in products:
            if p.id not in seen_product_ids:
                ctx.matched_products.append(p)
                seen_product_ids.add(p.id)

    # ── Catalog overview (si lo pidió o si está en discovery sin productos) ──
    if intent.needs_catalog_overview or (not ctx.matched_products and not intent.is_empty()):
        ctx.categories_summary, ctx.total_products = _prefetch_categories_summary(
            db, session.store_id, limit=8
        )

    # ── Descuentos vigentes (si pidió descuentos) ──
    if intent.needs_discounts:
        ctx.active_discounts = _prefetch_active_discounts(db, session.store_id, limit=5)

    if not ctx.is_empty():
        logger.info(
            f"[prefetch] products={len(ctx.matched_products)} "
            f"categories={len(ctx.categories_summary)} "
            f"discounts={len(ctx.active_discounts)} "
            f"personal_data={list(ctx.detected_personal_data.keys())} "
            f"wants_human={ctx.customer_wants_human} "
            f"wants_to_proceed={ctx.customer_wants_to_proceed}"
        )

    return ctx


# ════════════════════════════════════════════════════════════════════
#  Renderer del bloque para el prompt
# ════════════════════════════════════════════════════════════════════

def render_for_prompt(ctx: PrefetchedContext, currency: str = "USD") -> str:
    """
    Convierte el PrefetchedContext en un bloque markdown que se inyecta
    al system prompt. El LLM lee esto y SABE los datos sin tener que
    llamar tools.
    """
    if ctx.is_empty():
        return ""

    parts = [
        "## ════════════════════════════════════════════════",
        "## 📦 DATOS DISPONIBLES (consultados en DB ahora)",
        "## ════════════════════════════════════════════════",
        "",
        "Estos datos vienen DIRECTO de la base de datos en este turno.",
        "USALOS LITERALMENTE. No los modifiques. No inventes alternativas.",
        "Si un dato no aparece acá, NO lo afirmes — decí que tenés que chequear.",
        "",
    ]

    # ── Productos ──
    if ctx.matched_products:
        parts.append("### Productos que matchean lo que mencionó el cliente:")
        parts.append("")
        for p in ctx.matched_products:
            stock_line = ""
            if p.is_available:
                if not p.track_inventory:
                    stock_line = "stock: ✅ siempre disponible"
                elif p.allow_backorder and p.stock_quantity == 0:
                    days = f", llega en {p.lead_time_days}d" if p.lead_time_days else ""
                    stock_line = f"stock: 0 (backorder permitido{days})"
                else:
                    stock_line = f"stock: ✅ {p.stock_quantity} unidades"
            else:
                if p.lead_time_days:
                    stock_line = f"stock: ❌ 0 — proveedor en {p.lead_time_days} días"
                else:
                    stock_line = "stock: ❌ 0 (sin reposición confirmada)"

            price_line = f"${p.price}"
            if p.compare_at_price and p.compare_at_price > p.price:
                pct = round(((float(p.compare_at_price) - float(p.price)) / float(p.compare_at_price)) * 100, 1)
                price_line = f"${p.price} (antes ${p.compare_at_price}, -{pct}%)"

            cat = f" · {p.category_name}" if p.category_name else ""
            parts.append(f"  • **{p.name}** [id={p.id}]{cat}")
            parts.append(f"    — precio: {price_line} {currency}")
            parts.append(f"    — {stock_line}")

            if p.variants:
                in_stock_variants = [v for v in p.variants if v["available"]]
                if in_stock_variants:
                    var_names = ", ".join(v["name"] for v in in_stock_variants[:8])
                    parts.append(f"    — variantes con stock: {var_names}")
                else:
                    parts.append("    — variantes: ninguna con stock")

            # Origen / lead time (info interna, NO compartir literal con cliente)
            if p.origin_type and p.origin_type != "external_supplier":
                origin_label = {
                    "own_manufacturing": "fabricación propia",
                    "dropshipping": "dropshipping",
                    "imported": "importado",
                }.get(p.origin_type, p.origin_type)
                lead = f", lead {p.lead_time_days}d" if p.lead_time_days else ""
                parts.append(f"    — _interno: origen {origin_label}{lead}_")
            elif p.lead_time_days:
                parts.append(f"    — _interno: lead {p.lead_time_days}d_")

            if p.internal_notes:
                # Truncamos para no inflar el prompt
                note_short = (p.internal_notes or "")[:120].strip()
                if note_short:
                    parts.append(f"    — _nota interna (NO citar literal): {note_short}_")

            parts.append("")
    else:
        # No hubo match — informar claramente para que el LLM pueda decir
        # "no encontré X" y ofrecer alternativas (catálogo).
        # Solo si efectivamente intentamos buscar (hubo product_query).
        pass

    # ── Catalog overview ──
    if ctx.categories_summary:
        parts.append(f"### Catálogo de la tienda ({ctx.total_products} productos activos):")
        parts.append("")
        for c in ctx.categories_summary:
            parts.append(f"  • {c['name']} ({c['count']})")
        parts.append("")

    # ── Descuentos ──
    if ctx.active_discounts:
        parts.append("### Descuentos vigentes:")
        parts.append("")
        for d in ctx.active_discounts:
            parts.append(
                f"  • {d['name']}: ${d['now']} (antes ${d['original']}, -{d['pct']}%)"
            )
        parts.append("")

    # ── Datos personales detectados ──
    if ctx.detected_personal_data:
        parts.append("### Datos personales detectados en el último mensaje del cliente:")
        parts.append("")
        for key, value in ctx.detected_personal_data.items():
            parts.append(f"  • {key}: {value}")
        parts.append("")
        parts.append(
            "→ ACCIÓN: confirmá estos datos con el cliente y guardalos con `update_notebook`."
        )
        parts.append("")

    # ── Flags de intención ──
    if ctx.customer_wants_human:
        parts.append("### ⚠️ El cliente pidió HABLAR CON HUMANO.")
        parts.append("→ ACCIÓN: llamá `handoff_to_seller` con priority='alta' YA, sin completar fases pendientes.")
        parts.append("")

    if ctx.customer_wants_to_proceed:
        parts.append("### ✅ El cliente expresó intención de AVANZAR / COMPRAR.")
        parts.append("→ ACCIÓN: si ya tenés todos los datos del cliente, llamá `handoff_to_seller`. Si no, pasá a FASE 4 (data_collection).")
        parts.append("")

    parts.append("## ════════════════════════════════════════════════")
    parts.append("")

    return "\n".join(parts)
