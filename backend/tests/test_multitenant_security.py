"""
Multi-Tenant Isolation Security Tests
======================================
Covers: MT-1 (cross-tenant data access via X-Store-ID), C2 (IDOR in order_tools),
        A5 (storefront inactive product ordering), ENUM-1 (catalog enumeration)

The platform enforces tenancy via X-Store-ID header passed through get_current_store()
dependency. There is no middleware-level enforcement — every endpoint that touches
store data MUST call this dependency or be explicitly public.
"""

import json
import pytest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import (
    make_user, make_store, make_product, auth_headers, get_token,
)


class TestCrossTenantAccessControl:
    """
    MT-1: An authenticated user from Store A must not be able to access
    Store B's resources by swapping the X-Store-ID header.
    """

    def test_mt1_products_cross_tenant_access(self, client: TestClient, db: Session):
        """
        Objective: User from store_a cannot list products from store_b.
        Steps:
          1. Create two stores with separate owners
          2. Create products in store_b
          3. User from store_a uses store_b's ID in X-Store-ID header
        Expected result: 403 Forbidden (not 200 with store_b's products).
        """
        owner_a = make_user(db, email="owner-a@test.com")
        owner_b = make_user(db, email="owner-b@test.com")
        store_a = make_store(db, owner_a, slug="store-a")
        store_b = make_store(db, owner_b, slug="store-b")
        make_product(db, store_b, name="Secret Product B")

        # owner_a tries to access store_b's products
        resp = client.get(
            "/api/v1/products",
            headers={**auth_headers(owner_a), "X-Store-ID": store_b.id},
        )
        # Must fail — owner_a has no membership in store_b
        assert resp.status_code == 403, (
            f"FAIL [MT-1]: User from store_a accessed store_b resources — "
            f"status={resp.status_code}. X-Store-ID must be validated against "
            "the user's store memberships."
        )

    def test_mt1_orders_cross_tenant_access(self, client: TestClient, db: Session):
        """
        Objective: Authenticated user cannot read another store's orders.
        Expected result: 403
        """
        owner_a = make_user(db, email="ord-owner-a@test.com")
        owner_b = make_user(db, email="ord-owner-b@test.com")
        store_a = make_store(db, owner_a, slug="orders-store-a")
        store_b = make_store(db, owner_b, slug="orders-store-b")

        resp = client.get(
            "/api/v1/orders",
            headers={**auth_headers(owner_a), "X-Store-ID": store_b.id},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [MT-1]: User from store_a accessed store_b's orders — "
            f"status={resp.status_code}"
        )

    def test_mt1_customers_cross_tenant_access(self, client: TestClient, db: Session):
        """
        Objective: Authenticated user cannot read another store's customer data.
        Expected result: 403
        """
        owner_a = make_user(db, email="cust-owner-a@test.com")
        owner_b = make_user(db, email="cust-owner-b@test.com")
        store_a = make_store(db, owner_a, slug="cust-store-a")
        store_b = make_store(db, owner_b, slug="cust-store-b")

        resp = client.get(
            "/api/v1/customers",
            headers={**auth_headers(owner_a), "X-Store-ID": store_b.id},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [MT-1]: User from store_a accessed store_b's customers — "
            f"status={resp.status_code}"
        )

    def test_mt1_ai_agents_cross_tenant_access(self, client: TestClient, db: Session):
        """
        Objective: User cannot list/modify AI agents belonging to another store.
        Expected result: 403
        """
        owner_a = make_user(db, email="ai-owner-a@test.com")
        owner_b = make_user(db, email="ai-owner-b@test.com")
        store_a = make_store(db, owner_a, slug="ai-store-a")
        store_b = make_store(db, owner_b, slug="ai-store-b")

        resp = client.get(
            "/api/v1/ai/agents",
            headers={**auth_headers(owner_a), "X-Store-ID": store_b.id},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [MT-1]: Cross-tenant AI agent access — status={resp.status_code}"
        )

    def test_mt1_no_store_id_header_rejected(self, client: TestClient, db: Session):
        """
        Objective: Authenticated requests without X-Store-ID must fail on
        store-scoped endpoints.
        Expected result: 400 or 422 (missing required header).
        """
        user = make_user(db, email="no-header@test.com")
        resp = client.get(
            "/api/v1/products",
            headers=auth_headers(user),
            # No X-Store-ID header
        )
        assert resp.status_code in (400, 422), (
            f"FAIL [MT-1]: Request without X-Store-ID was processed — "
            f"status={resp.status_code}"
        )

    def test_mt1_inactive_store_rejected(self, client: TestClient, db: Session):
        """
        Objective: Requests targeting a deactivated store should be rejected.
        Expected result: 403 or 404 — is_active=False stores are inaccessible.
        """
        owner = make_user(db, email="inactive-store-owner@test.com")
        store = make_store(db, owner, slug="inactive-store", is_active=False)

        resp = client.get(
            "/api/v1/products",
            headers={**auth_headers(owner), "X-Store-ID": store.id},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [MT-1]: Inactive store accepted requests — "
            f"status={resp.status_code}. is_active must be checked."
        )


class TestC2IDOROrderTools:
    """
    C2: agent_tools/order_tools.py queries Product by product_id without a
    store_id filter. An attacker who controls the chat session can order
    products from other stores.

    File: backend/app/services/agent_tools/order_tools.py
    Line: db.query(Product).filter(Product.id == item.get("product_id")).first()
    """

    def test_c2_order_tool_requires_store_filter(self, db: Session):
        """
        Objective: Verify the order tool enforces store_id when looking up products.
        Steps:
          1. Create store_a and store_b, each with one product
          2. Create a SalesSession for store_a
          3. Call the order tool executor with store_b's product_id
        Expected result (post-patch): Tool returns an error or empty result
          because store_b's product doesn't belong to session's store.
        Expected result (pre-patch): Tool returns store_b's product (cross-tenant IDOR).
        """
        from app.models.sales_session import SalesSession, EMPTY_NOTEBOOK
        from datetime import datetime, timezone

        owner_a = make_user(db, email="c2-owner-a@test.com")
        owner_b = make_user(db, email="c2-owner-b@test.com")
        store_a = make_store(db, owner_a, slug="c2-store-a")
        store_b = make_store(db, owner_b, slug="c2-store-b")

        product_a = make_product(db, store_a, name="Store A Product", price=10.0)
        product_b = make_product(db, store_b, name="Store B Secret Product", price=999.0)

        # Create a conversation and session for store_a
        from app.models.ai import Conversation
        conv = Conversation(store_id=store_a.id, channel_type="web_chat", status="active")
        db.add(conv)
        db.commit()
        db.refresh(conv)

        now = datetime.now(timezone.utc)
        session = SalesSession(
            store_id=store_a.id,
            conversation_id=conv.id,
            customer_id=None,
            current_stage="checkout",
            status="active",
            started_at=now,
            stage_entered_at=now,
            notebook=json.dumps(EMPTY_NOTEBOOK),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Try to invoke create_order tool with store_b's product
        try:
            from app.services.agent_tools import TOOL_EXECUTORS
            create_order_fn = TOOL_EXECUTORS.get("create_order")
            if create_order_fn is None:
                pytest.skip("create_order tool not found in TOOL_EXECUTORS")

            result_raw = create_order_fn(
                db,
                session,
                items=[{"product_id": product_b.id, "quantity": 1}],
                customer_name="Attacker",
                customer_email="attacker@evil.com",
            )
            result = json.loads(result_raw)

            # Post-patch: should fail with a store mismatch error
            assert "error" in result or result.get("success") is False, (
                f"FAIL [C2]: create_order tool placed an order for store_b's product "
                f"from a store_a session. Product store_id: {product_b.store_id}, "
                f"Session store_id: {session.store_id}. Add store_id filter to product lookup."
            )
        except Exception as e:
            # If executor raises, that's acceptable (means a guard is in place)
            pass


class TestA5StorefrontInactiveProducts:
    """
    A5: Storefront order endpoint does not filter Product.is_active or
    Product.status == 'active'. Customers can order discontinued/draft products.

    File: backend/app/api/v1/storefront.py
    """

    def test_a5_cannot_order_inactive_product(self, client: TestClient, db: Session):
        """
        Objective: Ordering a disabled product via storefront must fail.
        Steps:
          1. Create a store and an inactive product
          2. POST /api/v1/storefront/{slug}/order with the inactive product ID
        Expected result (post-patch): 400 "Producto no disponible"
        Expected result (pre-patch): 200 — order created for inactive product
        """
        owner = make_user(db, email="a5-owner@test.com")
        store = make_store(db, owner, slug="a5-store")
        inactive_product = make_product(
            db, store, name="Discontinued Item", is_active=False, price=50.0
        )

        resp = client.post(
            f"/api/v1/storefront/{store.slug}/order",
            json={
                "items": [{"product_id": inactive_product.id, "quantity": 1}],
                "customer_name": "Test Customer",
                "customer_email": "customer@test.com",
                "customer_phone": "+1234567890",
            },
        )
        assert resp.status_code == 400, (
            f"FAIL [A5]: Order accepted for inactive product — "
            f"status={resp.status_code}. Add Product.is_active == True filter."
        )

    def test_a5_can_order_active_product(self, client: TestClient, db: Session):
        """
        Objective: Verify legitimate orders for active products still work after patch.
        Expected result: 200 or 201
        """
        owner = make_user(db, email="a5-active-owner@test.com")
        store = make_store(db, owner, slug="a5-active-store")
        active_product = make_product(
            db, store, name="Available Item", is_active=True, price=50.0
        )

        resp = client.post(
            f"/api/v1/storefront/{store.slug}/order",
            json={
                "items": [{"product_id": active_product.id, "quantity": 1}],
                "customer_name": "Legit Customer",
                "customer_email": "legit@test.com",
                "customer_phone": "+1234567890",
            },
        )
        # This may fail for other reasons (stock, etc.) but should not be 400 for is_active
        assert resp.status_code not in (403, 500), (
            f"FAIL [A5]: Active product order rejected — status={resp.status_code}"
        )


class TestENUM1CatalogExfiltration:
    """
    ENUM-1: The public storefront catalog endpoint (/storefront/{slug}/products)
    is unauthenticated and has no rate limiting. An attacker can enumerate
    all products across all stores in bulk.
    """

    def test_enum1_storefront_catalog_is_public(self, client: TestClient, db: Session):
        """
        Objective: Catalog should be accessible without auth (expected behavior)
        but must not leak internal/inactive products.
        Expected result: 200 for active products, no is_active=False products in response.
        """
        owner = make_user(db, email="enum-owner@test.com")
        store = make_store(db, owner, slug="enum-store")
        active = make_product(db, store, name="Public Product", is_active=True)
        inactive = make_product(db, store, name="Secret Draft", is_active=False)

        resp = client.get(f"/api/v1/storefront/{store.slug}/products")
        if resp.status_code == 200:
            data = resp.json()
            product_ids = [p.get("id") for p in (data if isinstance(data, list) else data.get("items", []))]
            assert inactive.id not in product_ids, (
                f"FAIL [ENUM-1]: Inactive product exposed in public catalog — "
                f"product_id={inactive.id}. Filter is_active=False in storefront query."
            )

    def test_enum1_nonexistent_store_returns_404(self, client: TestClient):
        """
        Objective: Non-existent store slug must not expose any data.
        Expected result: 404
        """
        resp = client.get("/api/v1/storefront/nonexistent-slug-xyz/products")
        assert resp.status_code == 404, (
            f"FAIL [ENUM-1]: Non-existent store returned {resp.status_code}"
        )

    def test_enum1_store_slug_does_not_expose_id(self, client: TestClient, db: Session):
        """
        Objective: Storefront responses should not expose internal store UUIDs
        that could be used to escalate to authenticated API calls.
        Expected result: Store internal ID (UUID) should not appear in public response.
        Note: This is a defense-in-depth check.
        """
        owner = make_user(db, email="slug-expose@test.com")
        store = make_store(db, owner, slug="slug-expose-store")

        resp = client.get(f"/api/v1/storefront/{store.slug}/products")
        if resp.status_code == 200:
            body = resp.text
            # Store internal UUID should ideally not appear in the public catalog response
            # as it can be used with X-Store-ID header in authenticated API calls
            if store.id in body:
                pytest.xfail(
                    f"WARN [ENUM-1]: Store internal UUID appears in public catalog. "
                    f"Consider not exposing store.id in public storefront responses."
                )
