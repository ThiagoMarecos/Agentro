"""
Authorization & Access Control Security Tests
===============================================
Covers: RBAC enforcement, admin endpoint protection, product/order IDOR,
        store membership role checks, superadmin endpoint hardening.

These tests verify that the dependency injection chain (get_current_store →
require_owner / require_admin / require_superadmin) correctly blocks
unauthorized access at each privilege level.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import make_user, make_store, make_product, auth_headers


class TestRBACEnforcement:
    """
    Role-based access: owner > admin > manager > support.
    Certain operations should be owner-only.
    """

    def test_rbac_support_cannot_delete_product(
        self, client: TestClient, db: Session
    ):
        """
        Objective: A 'support' role member cannot delete products.
        Expected result: 403
        """
        owner = make_user(db, email="rbac-owner@test.com")
        support_user = make_user(db, email="rbac-support@test.com")
        store = make_store(db, owner, slug="rbac-store")

        # Add support member to the store
        from app.models.store import StoreMember
        membership = StoreMember(
            store_id=store.id,
            user_id=support_user.id,
            role="support",
        )
        db.add(membership)
        db.commit()

        product = make_product(db, store)

        resp = client.delete(
            f"/api/v1/products/{product.id}",
            headers={**auth_headers(support_user), "X-Store-ID": store.id},
        )
        assert resp.status_code == 403, (
            f"FAIL [RBAC]: 'support' role deleted a product — "
            f"status={resp.status_code}. Only owner/admin should delete products."
        )

    def test_rbac_manager_cannot_manage_billing(
        self, client: TestClient, db: Session
    ):
        """
        Objective: 'manager' role cannot access billing/subscription endpoints.
        Expected result: 403
        """
        owner = make_user(db, email="rbac-mgr-owner@test.com")
        manager = make_user(db, email="rbac-manager@test.com")
        store = make_store(db, owner, slug="rbac-mgr-store")

        from app.models.store import StoreMember
        db.add(StoreMember(store_id=store.id, user_id=manager.id, role="manager"))
        db.commit()

        resp = client.get(
            "/api/v1/billing/subscription",
            headers={**auth_headers(manager), "X-Store-ID": store.id},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [RBAC]: 'manager' accessed billing — status={resp.status_code}"
        )

    def test_rbac_non_member_cannot_access_store(
        self, client: TestClient, db: Session
    ):
        """
        Objective: An authenticated user with no membership in a store cannot
        access that store's data at all.
        Expected result: 403
        """
        owner = make_user(db, email="rbac-no-member-owner@test.com")
        outsider = make_user(db, email="rbac-outsider@test.com")
        store = make_store(db, owner, slug="rbac-no-member-store")

        resp = client.get(
            "/api/v1/products",
            headers={**auth_headers(outsider), "X-Store-ID": store.id},
        )
        assert resp.status_code == 403, (
            f"FAIL [MT-1/RBAC]: User with no store membership accessed store data — "
            f"status={resp.status_code}"
        )


class TestProductIDOR:
    """
    IDOR tests on product endpoints.
    Products are scoped to stores via store_id FK, but direct ID access
    via /products/{id} could bypass store scope if not properly filtered.
    """

    def test_product_idor_cross_store_read(self, client: TestClient, db: Session):
        """
        Objective: GET /products/{id} must not return products from another store.
        Steps:
          1. Create product in store_b
          2. GET /products/{store_b_product_id} with store_a's X-Store-ID
        Expected result: 404 — product not found in store_a's scope.
        """
        owner_a = make_user(db, email="idor-a@test.com")
        owner_b = make_user(db, email="idor-b@test.com")
        store_a = make_store(db, owner_a, slug="idor-store-a")
        store_b = make_store(db, owner_b, slug="idor-store-b")
        product_b = make_product(db, store_b, name="Store B Private Product")

        resp = client.get(
            f"/api/v1/products/{product_b.id}",
            headers={**auth_headers(owner_a), "X-Store-ID": store_a.id},
        )
        assert resp.status_code == 404, (
            f"FAIL [IDOR]: store_a user read store_b's product — "
            f"status={resp.status_code}. Add store_id filter to GET /products/{{id}}."
        )

    def test_product_idor_cross_store_update(self, client: TestClient, db: Session):
        """
        Objective: PATCH /products/{id} must not update products from another store.
        Expected result: 404 or 403
        """
        owner_a = make_user(db, email="idor-upd-a@test.com")
        owner_b = make_user(db, email="idor-upd-b@test.com")
        store_a = make_store(db, owner_a, slug="idor-upd-store-a")
        store_b = make_store(db, owner_b, slug="idor-upd-store-b")
        product_b = make_product(db, store_b, name="Store B Product", price=100.0)

        resp = client.patch(
            f"/api/v1/products/{product_b.id}",
            headers={**auth_headers(owner_a), "X-Store-ID": store_a.id},
            json={"price": 0.01},  # attacker tries to reduce price
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [IDOR]: store_a user modified store_b's product — "
            f"status={resp.status_code}."
        )

    def test_product_idor_cross_store_delete(self, client: TestClient, db: Session):
        """
        Objective: DELETE /products/{id} must not delete products from another store.
        Expected result: 404 or 403
        """
        owner_a = make_user(db, email="idor-del-a@test.com")
        owner_b = make_user(db, email="idor-del-b@test.com")
        store_a = make_store(db, owner_a, slug="idor-del-store-a")
        store_b = make_store(db, owner_b, slug="idor-del-store-b")
        product_b = make_product(db, store_b, name="Product to Not Delete")

        resp = client.delete(
            f"/api/v1/products/{product_b.id}",
            headers={**auth_headers(owner_a), "X-Store-ID": store_a.id},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL [IDOR]: store_a user deleted store_b's product — "
            f"status={resp.status_code}."
        )

        # Verify product still exists
        from app.models.product import Product
        still_exists = db.query(Product).filter(Product.id == product_b.id).first()
        assert still_exists is not None, (
            "FAIL [IDOR]: Cross-store product deletion succeeded!"
        )


class TestOrderIDOR:
    """
    Order-level IDOR: orders belong to a store, but API access may allow
    cross-store reads or modifications if store_id filter is missing.
    """

    def test_order_idor_cross_store_read(self, client: TestClient, db: Session):
        """
        Objective: Cannot read another store's orders via order ID.
        Expected result: 404
        """
        owner_a = make_user(db, email="order-idor-a@test.com")
        owner_b = make_user(db, email="order-idor-b@test.com")
        store_a = make_store(db, owner_a, slug="order-idor-store-a")
        store_b = make_store(db, owner_b, slug="order-idor-store-b")

        # Create an order in store_b via direct DB insert
        from app.models.order import Order
        from app.models.customer import Customer

        customer = Customer(
            store_id=store_b.id,
            email="cust@test.com",
            first_name="Test",
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

        order = Order(
            store_id=store_b.id,
            customer_id=customer.id,
            status="pending",
            total_amount=100.0,
            currency="USD",
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # Try to read it as store_a owner
        resp = client.get(
            f"/api/v1/orders/{order.id}",
            headers={**auth_headers(owner_a), "X-Store-ID": store_a.id},
        )
        assert resp.status_code == 404, (
            f"FAIL [IDOR]: store_a user read store_b's order — "
            f"status={resp.status_code}."
        )


class TestAdminEndpointHardening:
    """
    Superadmin endpoints must be fully protected.
    Tests for privilege escalation and horizontal access.
    """

    def test_admin_users_list_requires_superadmin(
        self, client: TestClient, db: Session
    ):
        """
        Objective: /admin/users must require is_superadmin=True.
        Expected result: 403 for regular users.
        """
        regular = make_user(db, email="admin-ep-regular@test.com")
        resp = client.get(
            "/api/v1/admin/users",
            headers=auth_headers(regular),
        )
        assert resp.status_code in (403, 404), (
            f"FAIL: Regular user accessed admin users list — status={resp.status_code}"
        )

    def test_admin_user_deactivation_requires_superadmin(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Only superadmin can deactivate users.
        Expected result: 403 for regular authenticated users.
        """
        regular = make_user(db, email="admin-deact-regular@test.com")
        target = make_user(db, email="admin-deact-target@test.com")

        resp = client.patch(
            f"/api/v1/admin/users/{target.id}",
            headers=auth_headers(regular),
            json={"is_active": False},
        )
        assert resp.status_code in (403, 404), (
            f"FAIL: Regular user deactivated another user — status={resp.status_code}"
        )

    def test_cannot_self_escalate_to_superadmin(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Users must not be able to set is_superadmin=True on their own profile.
        Expected result: 403 or field ignored in response.
        """
        user = make_user(db, email="escalate@test.com", is_superadmin=False)

        resp = client.patch(
            "/api/v1/auth/me",
            headers=auth_headers(user),
            json={"is_superadmin": True},
        )

        if resp.status_code in (200, 204):
            # If the endpoint exists, verify the field was ignored
            from app.models.user import User as UserModel
            db.refresh(user)
            assert not user.is_superadmin, (
                "FAIL: User successfully escalated to superadmin via profile update!"
            )
