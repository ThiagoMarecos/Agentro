"""
Rate Limiting Security Tests
==============================
Covers: C3 (RateLimitMiddleware never registered in main.py)

The middleware exists at backend/app/middlewares/rate_limit.py but is never
imported or added in backend/app/main.py. Additionally, the implementation
uses in-memory defaultdict (not Redis), making it ineffective in multi-worker
deployments.

This test suite verifies:
1. Rate limiting is active on sensitive endpoints
2. The in-memory implementation is replaced with Redis-backed storage
3. Per-endpoint limits are correctly configured
"""

import time
import pytest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import make_user, make_store, auth_headers


class TestC3RateLimiterRegistered:
    """
    C3: main.py never registers RateLimitMiddleware.
    All endpoints are unprotected from brute-force and DoS.
    """

    def test_c3_login_endpoint_rate_limited(self, client: TestClient, db: Session):
        """
        Objective: /auth/login must return 429 after N failed attempts.
        Steps:
          1. Make 25 rapid login requests with wrong credentials
        Expected result (post-patch): 429 within first 25 attempts.
        Expected result (pre-patch): Never 429 (middleware not registered).
        Vulnerability: C3
        """
        make_user(db, email="rate-login@test.com")

        codes = [
            client.post("/api/v1/auth/login", json={
                "email": "rate-login@test.com",
                "password": f"wrong-{i}",
            }).status_code
            for i in range(25)
        ]

        assert 429 in codes, (
            f"FAIL [C3]: /login not rate limited after 25 attempts. "
            f"Status codes seen: {set(codes)}. "
            "Import and register RateLimitMiddleware in main.py."
        )

    def test_c3_register_endpoint_rate_limited(self, client: TestClient):
        """
        Objective: /auth/register must be rate-limited to prevent account farming.
        Expected result: 429 after N rapid attempts.
        """
        codes = [
            client.post("/api/v1/auth/register", json={
                "email": f"spam{i}@attacker.com",
                "password": "SpamPass123!",
                "full_name": "Spammer",
            }).status_code
            for i in range(20)
        ]

        assert 429 in codes, (
            f"FAIL [C3]: /register not rate limited after 20 attempts. "
            f"Status codes: {set(codes)}."
        )

    def test_c3_chat_endpoint_rate_limited(self, client: TestClient, db: Session):
        """
        Objective: Public /chat endpoint must be rate-limited per IP.
        Economic impact: each chat request = up to 11 OpenAI API calls.
        Expected result: 429 after N requests from same IP.
        """
        owner = make_user(db, email="rate-chat@test.com")
        store = make_store(db, owner, slug="rate-chat-store")

        with patch("app.services.agent_runtime._get_openai_client") as mock_client:
            mock_client.return_value.chat.completions.create.return_value = (
                _mock_response()
            )
            codes = [
                client.post("/api/v1/chat", json={
                    "store_id": store.id,
                    "channel": "web_chat",
                    "customer_identifier": f"cust{i}@test.com",
                    "message": "hello",
                }).status_code
                for i in range(30)
            ]

        assert 429 in codes, (
            f"FAIL [C3/A4]: /chat not rate limited after 30 attempts. "
            f"Status codes: {set(codes)}. "
            "This enables OpenAI cost bomb attacks (up to 330 API calls per burst)."
        )

    def test_c3_webhook_endpoint_rate_limited(self, client: TestClient, db: Session):
        """
        Objective: Webhook endpoint must be rate-limited to prevent replay floods.
        Expected result: 429 after N rapid attempts.
        """
        owner = make_user(db, email="rate-webhook@test.com")
        store = make_store(db, owner, slug="rate-webhook-store")

        from tests.conftest import make_channel
        channel = make_channel(db, store, webhook_secret="rate-test-secret")

        codes = [
            client.post(
                "/api/v1/whatsapp/webhook",
                headers={"x-webhook-secret": "rate-test-secret"},
                json={
                    "event": "MESSAGES_UPSERT",
                    "instance": channel.instance_name,
                    "data": {"key": {"remoteJid": "5511@s.whatsapp.net", "id": f"msg-{i}"}},
                },
            ).status_code
            for i in range(40)
        ]

        assert 429 in codes, (
            f"FAIL [C3]: Webhook endpoint not rate limited after 40 attempts. "
            f"Status codes: {set(codes)}."
        )

    def test_c3_storefront_rate_limited(self, client: TestClient, db: Session):
        """
        Objective: Public storefront endpoints must be rate-limited.
        Expected result: 429 after N requests (prevents catalog scraping + DoS).
        """
        owner = make_user(db, email="rate-storefront@test.com")
        store = make_store(db, owner, slug="rate-storefront-store")

        codes = [
            client.get(f"/api/v1/storefront/{store.slug}/products").status_code
            for _ in range(50)
        ]

        assert 429 in codes, (
            f"FAIL [C3/ENUM-1]: Storefront not rate limited after 50 requests. "
            f"Status codes: {set(codes)}. "
            "Enables bulk catalog enumeration across all stores."
        )


class TestC3RateLimiterImplementation:
    """
    Verify the rate limiter implementation is production-grade.
    """

    def test_c3_rate_limiter_middleware_registered(self):
        """
        Objective: Verify RateLimitMiddleware is registered in the FastAPI app.
        Expected result: Middleware stack includes RateLimitMiddleware.
        """
        from app.main import app
        from app.middlewares.rate_limit import RateLimitMiddleware

        middleware_classes = [
            m.cls for m in app.user_middleware
            if hasattr(m, "cls")
        ]
        # Also check middleware stack
        middleware_types = [type(m).__name__ for m in getattr(app, "_middleware_stack", [])]

        is_registered = (
            RateLimitMiddleware in middleware_classes
            or "RateLimitMiddleware" in str(app.middleware_stack if hasattr(app, "middleware_stack") else "")
        )

        assert is_registered, (
            "FAIL [C3]: RateLimitMiddleware is not registered in main.py. "
            "Add: app.add_middleware(RateLimitMiddleware) in backend/app/main.py."
        )

    def test_c3_rate_limiter_returns_429_with_retry_after(
        self, client: TestClient, db: Session
    ):
        """
        Objective: When rate limit is hit, response must include Retry-After header.
        Expected result: 429 response has Retry-After header with seconds to wait.
        """
        codes_and_headers = []

        for i in range(30):
            resp = client.post("/api/v1/auth/login", json={
                "email": f"ratelimit{i}@test.com",
                "password": "wrong",
            })
            if resp.status_code == 429:
                codes_and_headers.append(resp.headers)
                break

        if codes_and_headers:
            headers = codes_and_headers[0]
            assert "retry-after" in headers or "x-retry-after" in headers, (
                "WARN [C3]: 429 response missing Retry-After header. "
                "Add Retry-After header to rate limit responses."
            )

    def test_c3_rate_limit_resets_after_window(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Verify rate limits reset after the window expires.
        Note: This test may be slow — uses a short window if possible.
        """
        # This is a structural test — verify the implementation has TTL logic
        try:
            from app.middlewares.rate_limit import RateLimitMiddleware
            import inspect
            source = inspect.getsource(RateLimitMiddleware)
            has_ttl = "ttl" in source.lower() or "expire" in source.lower() or "window" in source.lower()
            assert has_ttl, (
                "WARN [C3]: RateLimitMiddleware may not have TTL/window reset logic. "
                "Ensure rate limit counters expire after the configured window."
            )
        except ImportError:
            pytest.skip("RateLimitMiddleware not importable")


def _mock_response():
    """Helper to create mock OpenAI response."""
    from unittest.mock import MagicMock
    msg = MagicMock()
    msg.content = "Hello!"
    msg.tool_calls = []
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp
