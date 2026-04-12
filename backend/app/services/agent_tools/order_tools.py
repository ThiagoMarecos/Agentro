"""
Tools de órdenes: envío, pago, creación de orden.
"""

import json
from uuid import uuid4
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.sales_session import SalesSession
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.services.audit_service import log_action


def tool_estimate_shipping(db: Session, session: SalesSession, **params) -> str:
    """Estima costo de envío (stub inicial, extensible)."""
    address = params.get("address", "")
    method = params.get("method", "standard")

    cost_map = {
        "standard": 5.99,
        "express": 12.99,
        "overnight": 24.99,
    }
    cost = cost_map.get(method, 5.99)

    nb = session.get_notebook()
    nb["shipping"]["address"] = address
    nb["shipping"]["method"] = method
    nb["shipping"]["estimated_cost"] = cost
    session.set_notebook(nb)

    return json.dumps({
        "method": method,
        "estimated_cost": cost,
        "currency": session.currency or "USD",
        "estimated_days": {"standard": "5-7", "express": "2-3", "overnight": "1"}.get(method, "5-7"),
    })


def tool_create_payment_link(db: Session, session: SalesSession, **params) -> str:
    """Genera link de pago (stub inicial, extensible con Stripe/PayPal)."""
    amount = params.get("amount", 0)
    method = params.get("method", "link")

    payment_id = str(uuid4())[:8]
    link = f"https://pay.nexora.app/{payment_id}"

    nb = session.get_notebook()
    nb["payment"]["method"] = method
    nb["payment"]["status"] = "pending"
    nb["payment"]["link"] = link
    nb["payment"]["transaction_id"] = payment_id
    session.set_notebook(nb)

    return json.dumps({
        "payment_link": link,
        "payment_id": payment_id,
        "amount": amount,
        "status": "pending",
    })


def tool_create_order(db: Session, session: SalesSession, **params) -> str:
    """Crea una orden con los items especificados."""
    items_data = params.get("items", [])
    if not items_data:
        return json.dumps({"error": "No se proporcionaron items"})

    order_number = f"NX-{str(uuid4())[:8].upper()}"

    subtotal = Decimal("0")
    order_items = []

    for item in items_data:
        product = db.query(Product).filter(Product.id == item.get("product_id")).first()
        if not product:
            continue

        qty = item.get("quantity", 1)
        unit_price = product.price or Decimal("0")
        total_price = unit_price * qty
        subtotal += total_price

        order_items.append(OrderItem(
            product_id=product.id,
            variant_id=item.get("variant_id"),
            name=product.name,
            sku=product.sku or "",
            quantity=qty,
            unit_price=unit_price,
            total_price=total_price,
        ))

    if not order_items:
        return json.dumps({"error": "No se encontraron productos válidos"})

    nb = session.get_notebook()
    shipping_cost = Decimal(str(nb["shipping"].get("estimated_cost", 0)))
    total = subtotal + shipping_cost

    order = Order(
        store_id=session.store_id,
        customer_id=session.customer_id,
        order_number=order_number,
        status="pending",
        subtotal=subtotal,
        shipping_amount=shipping_cost,
        total=total,
        currency=session.currency or "USD",
        notes=f"Orden creada automáticamente por agente IA. Session: {session.id}",
        items=order_items,
    )

    db.add(order)
    db.commit()
    db.refresh(order)

    nb["order"]["order_id"] = order.id
    nb["order"]["items"] = [{"name": oi.name, "qty": oi.quantity, "price": str(oi.unit_price)} for oi in order_items]
    nb["order"]["total"] = str(total)
    nb["pricing"]["total"] = str(total)
    session.set_notebook(nb)

    session.estimated_value = total
    db.add(session)
    db.commit()

    log_action(
        db,
        "order.created_by_agent",
        store_id=session.store_id,
        resource_type="order",
        resource_id=order.id,
        details={"order_number": order_number, "session_id": session.id, "total": str(total)},
    )

    return json.dumps({
        "order_id": order.id,
        "order_number": order_number,
        "subtotal": str(subtotal),
        "shipping": str(shipping_cost),
        "total": str(total),
        "items_count": len(order_items),
        "status": "pending",
    }, ensure_ascii=False)


ORDER_TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "estimate_shipping",
            "description": "Estimar costo y tiempo de envío para una dirección",
            "parameters": {
                "type": "object",
                "properties": {
                    "address": {"type": "string", "description": "Dirección de envío"},
                    "method": {
                        "type": "string",
                        "description": "Método de envío",
                        "enum": ["standard", "express", "overnight"],
                    },
                },
                "required": ["address"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_payment_link",
            "description": "Generar un enlace de pago para el cliente",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Monto a cobrar"},
                    "method": {"type": "string", "description": "Método de pago"},
                },
                "required": ["amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_order",
            "description": "Crear una orden de compra con los productos seleccionados",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "description": "Lista de items del pedido",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "string"},
                                "variant_id": {"type": "string"},
                                "quantity": {"type": "integer", "default": 1},
                            },
                            "required": ["product_id"],
                        },
                    },
                },
                "required": ["items"],
            },
        },
    },
]
