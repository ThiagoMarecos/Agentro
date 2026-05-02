"""
Modelos SQLAlchemy de Nexora.
Importar todos los modelos aquí para que Alembic los detecte.
"""

from app.models.user import User, Role
from app.models.store import Store, StoreMember, StoreTheme
from app.models.product import Product, ProductVariant, ProductImage, Category
from app.models.order import Order, OrderItem
from app.models.customer import Customer, Address
from app.models.ai import Conversation, Message, AIChannel, AIAgent, AgentLesson
from app.models.sales_session import SalesSession
from app.models.wishlist import Wishlist
from app.models.next_drop import NextDropItem
from app.models.audit import AuditLog
from app.models.settings import Setting
from app.models.supplier import Supplier
from app.models.team import TeamInvitation
from app.models.payment import PaymentMethod, CashRegister, Refund

__all__ = [
    "User",
    "Role",
    "Store",
    "StoreMember",
    "StoreTheme",
    "Product",
    "ProductVariant",
    "ProductImage",
    "Category",
    "Order",
    "OrderItem",
    "Customer",
    "Address",
    "Conversation",
    "Message",
    "AIChannel",
    "AIAgent",
    "AgentLesson",
    "SalesSession",
    "Wishlist",
    "NextDropItem",
    "AuditLog",
    "Setting",
    "Supplier",
    "TeamInvitation",
    "PaymentMethod",
    "CashRegister",
    "Refund",
]
