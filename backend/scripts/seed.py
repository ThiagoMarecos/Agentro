"""
Script de seed para datos de desarrollo.
Crea: user demo, store demo, productos, categorías, agente IA, conversación, drop.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.user import User
from app.models.store import Store, StoreMember, StoreTheme
from app.models.product import Product, ProductVariant, ProductImage, Category
from app.models.customer import Customer
from app.models.ai import AIAgent, AIChannel, Conversation, Message
from app.models.next_drop import NextDropItem
from app.models.settings import Setting
from app.core.security import get_password_hash


def seed():
    db = SessionLocal()
    try:
        # User demo
        user = db.query(User).filter(User.email == "demo@nexora.dev").first()
        if not user:
            user = User(
                email="demo@nexora.dev",
                hashed_password=get_password_hash("demo123"),
                full_name="Demo User",
                is_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created user: demo@nexora.dev / demo123")
        else:
            print("User demo already exists")

        # Store demo
        store = db.query(Store).filter(Store.slug == "demo-store").first()
        if not store:
            store = Store(
                name="Demo Store",
                slug="demo-store",
                description="Tienda de demostración",
                industry="Moda",
                country="US",
                currency="USD",
                language="es",
                template_id="minimal",
            )
            db.add(store)
            db.flush()

            db.add(StoreMember(store_id=store.id, user_id=user.id, role="owner"))
            db.add(StoreTheme(store_id=store.id, template_name="minimal"))
            db.add(Setting(store_id=store.id, key="store_name", value="Demo Store"))
            db.add(Setting(store_id=store.id, key="currency", value="USD"))
            db.commit()
            db.refresh(store)
            print("Created store: demo-store")
        else:
            print("Store demo already exists")

        # Categories
        cat1 = db.query(Category).filter(
            Category.store_id == store.id, Category.slug == "ropa"
        ).first()
        if not cat1:
            cat1 = Category(
                store_id=store.id,
                name="Ropa",
                slug="ropa",
                sort_order=0,
            )
            db.add(cat1)
            db.flush()
            print("Created category: Ropa")

        cat2 = db.query(Category).filter(
            Category.store_id == store.id, Category.slug == "accesorios"
        ).first()
        if not cat2:
            cat2 = Category(
                store_id=store.id,
                name="Accesorios",
                slug="accesorios",
                sort_order=1,
            )
            db.add(cat2)
            db.flush()
            print("Created category: Accesorios")

        # Products
        PLACEHOLDER_IMG = "https://placehold.co/400x400/1e293b/94a3b8?text=Product"
        for i, (name, slug, price, has_variants) in enumerate([
            ("Camiseta Basic", "camiseta-basic", 29.99, True),
            ("Hoodie Premium", "hoodie-premium", 79.99, False),
            ("Gorra Logo", "gorra-logo", 24.99, True),
            ("Mochila Urban", "mochila-urban", 59.99, False),
            ("Pantalón Cargo", "pantalon-cargo", 89.99, True),
        ]):
            existing = db.query(Product).filter(
                Product.store_id == store.id, Product.slug == slug
            ).first()
            if not existing:
                p = Product(
                    store_id=store.id,
                    category_id=cat1.id if i < 3 else cat2.id,
                    name=name,
                    slug=slug,
                    description=f"Producto de demostración: {name}",
                    price=price,
                    is_active=True,
                    status="active",
                    product_type="variant" if has_variants else "simple",
                    has_variants=has_variants,
                    stock_quantity=0 if has_variants else 10,
                    cover_image_url=PLACEHOLDER_IMG,
                )
                db.add(p)
                db.flush()
                db.add(ProductImage(
                    product_id=p.id, store_id=store.id,
                    url=PLACEHOLDER_IMG, alt_text=name, sort_order=0, is_cover=True,
                ))
                if has_variants:
                    for size, stock in [("S", 5), ("M", 8), ("L", 3)]:
                        db.add(ProductVariant(
                            product_id=p.id, store_id=store.id,
                            name=f"{name} - {size}",
                            price=price,
                            stock_quantity=stock,
                            option_values={"size": size},
                        ))
                print(f"Created product: {name}")
        db.commit()

        # AI Agent
        agent = db.query(AIAgent).filter(
            AIAgent.store_id == store.id, AIAgent.name == "Asistente Demo"
        ).first()
        if not agent:
            agent = AIAgent(
                store_id=store.id,
                name="Asistente Demo",
                description="Asistente de ventas para la tienda demo",
                system_prompt="Eres un asistente de ventas amable y profesional.",
                is_active=True,
            )
            db.add(agent)
            db.flush()
            print("Created AI agent: Asistente Demo")
        db.commit()

        # Next Drop
        drop = db.query(NextDropItem).filter(
            NextDropItem.store_id == store.id, NextDropItem.name == "Colección Verano"
        ).first()
        if not drop:
            drop = NextDropItem(
                store_id=store.id,
                name="Colección Verano",
                description="Nueva colección próximamente",
                is_active=True,
                sort_order=0,
            )
            db.add(drop)
            print("Created next drop: Colección Verano")
        db.commit()

        print("\nSeed completado. Storefront: /store/demo-store")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
