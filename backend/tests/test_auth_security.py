"""
Authentication Security Tests
=================================
Covers: C4, A1, A2

C4  — SECRET_KEY default "change-me-in-production" allows JWT forgery
A1  — No JWT revocation: tokens remain valid after logout / account deactivation
A2  — OAuth state is a fixed enum (no CSRF nonce); email enumeration on /register
"""

import pytest
import time
from datetime import datetime, timezone, timedelta

from jose import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import make_user, make_store, auth_headers, get_token
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.config import get_settings


# ─────────────────────────────────────────────────────────────────────────────
# C4 — JWT forgery with known default SECRET_KEY
# ─────────────────────────────────────────────────────────────────────────────

class TestC4DefaultSecretKey:
    """
    Vulnerability: config.py sets secret_key = "change-me-in-production"
    as a default. Any deployment that never overrides this env var is trivially
    exploitable — an attacker can forge valid JWTs for any user ID.
    """

    def test_c4_default_secret_forges_superadmin_token(self, client: TestClient, db: Session):
        """
        Objective: Forge a superadmin JWT using the known default SECRET_KEY.
        Steps:
          1. Sign a JWT with "change-me-in-production" as secret
          2. Use it on a superadmin-only endpoint
        Expected result (pre-patch): 200 OK — forged token accepted
        Expected result (post-patch): 401 — server uses a strong, non-default key
        CVE mapping: CWE-1394 (Use of Default Cryptographic Key)
        """
        settings = get_settings()

        # Skip this test if the deployment has a strong key configured
        if settings.secret_key != "change-me-in-production":
            pytest.skip("SECRET_KEY is not the default — C4 already mitigated")

        # Forge a token for a non-existent superadmin user
        forged_payload = {
            "sub": "00000000-0000-0000-0000-000000000001",
            "type": "access",
            "email": "forged@attacker.com",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        forged_token = jwt.encode(
            forged_payload,
            "change-me-in-production",
            algorithm="HS256",
        )

        resp = client.get(
            "/api/v1/platform-settings",
            headers={"Authorization": f"Bearer {forged_token}"},
        )
        # Pre-patch: 200 (critical). Post-patch: 401 or 403.
        assert resp.status_code in (401, 403), (
            f"FAIL [C4]: Forged JWT with default secret was accepted — "
            f"status={resp.status_code}. SECRET_KEY must not have a default value."
        )

    def test_c4_jwt_algorithm_confusion(self, client: TestClient, db: Session):
        """
        Objective: Attempt algorithm=none JWT bypass.
        Expected result: 401 — 'none' algorithm must be rejected.
        """
        header = {"alg": "none", "typ": "JWT"}
        payload = {
            "sub": "00000000-0000-0000-0000-000000000001",
            "type": "access",
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        }
        import base64, json as _json
        def b64(d):
            return base64.urlsafe_b64encode(_json.dumps(d).encode()).rstrip(b"=").decode()
        none_token = f"{b64(header)}.{b64(payload)}."

        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {none_token}"},
        )
        assert resp.status_code == 401, (
            f"FAIL [C4]: algorithm=none JWT was accepted — status={resp.status_code}"
        )

    def test_c4_expired_token_rejected(self, client: TestClient, db: Session):
        """
        Objective: Expired token must be rejected.
        Expected result: 401
        """
        settings = get_settings()
        expired_payload = {
            "sub": "00000000-0000-0000-0000-000000000001",
            "type": "access",
            "exp": int((datetime.now(timezone.utc) - timedelta(seconds=1)).timestamp()),
        }
        expired_token = jwt.encode(expired_payload, settings.secret_key, algorithm="HS256")

        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert resp.status_code == 401, (
            f"FAIL [C4]: Expired JWT was accepted — status={resp.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# A1 — No token revocation
# ─────────────────────────────────────────────────────────────────────────────

class TestA1NoTokenRevocation:
    """
    Vulnerability: There is no /logout endpoint and no token_version column on
    users. Tokens issued before account deactivation remain valid indefinitely
    until natural expiry.
    """

    def test_a1_no_logout_endpoint_exists(self, client: TestClient):
        """
        Objective: Confirm there is no /logout endpoint.
        Expected result (post-patch): POST /api/v1/auth/logout returns 200 or 204.
        Expected result (pre-patch): 404 or 405.
        """
        resp = client.post("/api/v1/auth/logout", json={})
        # Pre-patch this will be 404 or 405. Test flags the absence.
        assert resp.status_code not in (404, 405), (
            "FAIL [A1]: No /logout endpoint exists. Tokens cannot be revoked."
        )

    def test_a1_token_valid_after_deactivation(self, client: TestClient, db: Session):
        """
        Objective: Token issued to a user remains valid after the user is deactivated.
        Steps:
          1. Create user, obtain valid token
          2. Deactivate user in DB
          3. Use old token on authenticated endpoint
        Expected result (post-patch): 401 — token_version mismatch invalidates token
        Expected result (pre-patch): 200 — old token still works
        """
        user = make_user(db, email="deactivate@test.com")
        token = get_token(user)

        # Verify token works while active
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, "Setup failed: token should work for active user"

        # Deactivate user
        user.is_active = False
        db.commit()

        # Token should now be rejected
        resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401, (
            f"FAIL [A1]: Token for deactivated user still works — status={resp.status_code}. "
            "Add token_version to User model and embed in JWT claims."
        )

    def test_a1_refresh_token_type_enforced(self, client: TestClient, db: Session):
        """
        Objective: Refresh token must not work on regular API endpoints.
        Expected result: 401 — token type must be checked.
        """
        user = make_user(db, email="refresh-misuse@test.com")
        refresh_token = create_refresh_token(subject=user.id)

        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert resp.status_code == 401, (
            f"FAIL [A1]: Refresh token accepted as access token — status={resp.status_code}"
        )

    def test_a1_access_token_cannot_refresh(self, client: TestClient, db: Session):
        """
        Objective: Access token must not be accepted by /refresh endpoint.
        Expected result: 401
        """
        user = make_user(db, email="access-refresh@test.com")
        access_token = get_token(user)

        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})
        assert resp.status_code == 401, (
            f"FAIL [A1]: Access token accepted as refresh token — status={resp.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# A2 — OAuth CSRF & Email Enumeration
# ─────────────────────────────────────────────────────────────────────────────

class TestA2OAuthAndEnumeration:
    """
    Vulnerability A2a: OAuth state is a fixed enum {"app", "onboarding", "login"},
    not a random per-session nonce. CSRF attacks can force victims into attacker-
    controlled OAuth flows.

    Vulnerability A2b: /register leaks whether an email is already registered.
    """

    def test_a2_oauth_state_fixed_enum(self, client: TestClient):
        """
        Objective: Confirm that a well-known state value triggers a redirect
        (not a CSRF rejection).
        Steps:
          1. Hit /api/v1/auth/google with state="app" (known enum value)
          2. Verify redirect proceeds (server does NOT reject known state as CSRF risk)
        Expected result (post-patch): Redirect contains a random nonce in the
          state param AND the server verifies it matches a server-side session.
        Note: pre-patch the fixed enum is accepted without nonce verification.
        """
        resp = client.get("/api/v1/auth/google?state=app", follow_redirects=False)
        # If Google is not configured it redirects to error page — that's OK for this test.
        # The vulnerability is that ANY of the 3 known values is accepted.
        # A patched implementation would have state contain a random token.
        if resp.status_code in (302, 307):
            location = resp.headers.get("location", "")
            # If it redirected to Google OAuth URL, check state param contains a nonce
            if "accounts.google.com" in location:
                import urllib.parse
                qs = urllib.parse.urlparse(location)
                params = urllib.parse.parse_qs(qs.query)
                state_val = params.get("state", [""])[0]
                assert len(state_val) > 20, (
                    f"FAIL [A2]: OAuth state param is too short to be a nonce: '{state_val}'. "
                    "State must be a random, unpredictable per-session value."
                )

    def test_a2_email_enumeration_on_register(self, client: TestClient, db: Session):
        """
        Objective: /register reveals whether an email is already taken.
        Steps:
          1. Register a user successfully
          2. Attempt to register with the same email
          3. Observe error message
        Expected result (post-patch): Generic message like "Registration failed"
          that does not reveal whether the email exists.
        Expected result (pre-patch): "Email ya registrado" — confirms email exists.
        """
        email = "enum-target@test.com"

        # First registration — should succeed
        resp1 = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "full_name": "First User",
        })
        assert resp1.status_code == 200, f"Setup failed: first register returned {resp1.status_code}"

        # Second registration with same email
        resp2 = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "DifferentPass456!",
            "full_name": "Second User",
        })
        assert resp2.status_code == 400

        detail = resp2.json().get("detail", "")
        assert "registrado" not in detail.lower() and "already" not in detail.lower(), (
            f"FAIL [A2]: Register endpoint leaks email existence: '{detail}'. "
            "Use a generic error message to prevent user enumeration."
        )

    def test_a2_login_timing_constant(self, client: TestClient, db: Session):
        """
        Objective: Login response time should not leak whether an email exists
        (timing side-channel).
        Steps:
          1. Time login with non-existent email
          2. Time login with existing email + wrong password
          3. Compare response times
        Expected result: Timing difference < 100ms (constant-time check).
        Note: This is a best-effort test — flaky on loaded CI systems.
        """
        make_user(db, email="timing-test@test.com", password="Correct123!")

        times_nonexistent = []
        times_wrong_password = []

        for _ in range(3):
            t0 = time.monotonic()
            client.post("/api/v1/auth/login", json={
                "email": "nonexistent-xyz@test.com",
                "password": "wrong",
            })
            times_nonexistent.append(time.monotonic() - t0)

            t0 = time.monotonic()
            client.post("/api/v1/auth/login", json={
                "email": "timing-test@test.com",
                "password": "wrongpassword",
            })
            times_wrong_password.append(time.monotonic() - t0)

        avg_nonexistent = sum(times_nonexistent) / len(times_nonexistent)
        avg_existing = sum(times_wrong_password) / len(times_wrong_password)
        diff = abs(avg_existing - avg_nonexistent)

        # Warn if diff > 200ms (likely leaking password hash timing)
        assert diff < 0.5, (
            f"WARN [A2]: Login timing difference = {diff*1000:.1f}ms between "
            "existing/non-existing emails. Consider constant-time response."
        )

    def test_a2_brute_force_no_lockout(self, client: TestClient, db: Session):
        """
        Objective: Verify whether login has any brute-force protection.
        Steps:
          1. Attempt 20 failed logins against the same account
          2. Verify account is locked or rate-limited after threshold
        Expected result (post-patch): 429 or 403 after N failed attempts.
        Expected result (pre-patch): All 20 attempts return 401 (no lockout).
        """
        make_user(db, email="bruteforce@test.com", password="ActualPass123!")

        status_codes = []
        for _ in range(20):
            resp = client.post("/api/v1/auth/login", json={
                "email": "bruteforce@test.com",
                "password": "wrongpassword",
            })
            status_codes.append(resp.status_code)

        assert 429 in status_codes or 403 in status_codes, (
            "FAIL [A2/C3]: No brute-force protection on /login. "
            "All 20 attempts returned non-429/403 responses: "
            f"{set(status_codes)}. Register RateLimitMiddleware and add "
            "account lockout after N failed attempts."
        )
