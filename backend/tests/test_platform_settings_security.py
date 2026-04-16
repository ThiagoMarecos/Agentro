"""
Platform Settings Security Tests
==================================
Covers: M4 (real_value exposed in API), Fernet key bootstrap vulnerability,
        superadmin access control, settings exposure via normal user

M4: backend/app/api/v1/platform_settings.py — GET /platform-settings returns
    real_value (decrypted plaintext) for all secrets including openai_api_key,
    google_client_secret, and JWT secret_key.
    File: backend/app/services/platform_settings_service.py — get_all_settings()

The secondary issue: the Fernet encryption key is derived from SECRET_KEY.
If SECRET_KEY is the default "change-me-in-production", all stored secrets
can be decrypted without access to the database (C4 + M4 chained attack).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import make_user, make_store, auth_headers
from app.models.platform_settings import PlatformSetting
from app.services.platform_settings_service import (
    encrypt_value,
    decrypt_value,
    get_all_settings,
    update_setting,
)


SETTINGS_URL = "/api/v1/platform-settings"


class TestM4RealValueExposure:
    """
    M4: The GET /platform-settings endpoint returns `real_value` containing
    the decrypted plaintext of all secrets. Only superadmins can call this
    endpoint, but once compromised, they get all secrets in one request.
    Additionally, the response structure exposes the JWT secret key itself,
    which can be used to forge tokens.
    """

    def test_m4_non_superadmin_cannot_access_settings(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Regular users must not access platform settings.
        Expected result: 403
        """
        user = make_user(db, email="m4-regular@test.com", is_superadmin=False)

        resp = client.get(SETTINGS_URL, headers=auth_headers(user))
        assert resp.status_code == 403, (
            f"FAIL [M4]: Regular user accessed platform settings — "
            f"status={resp.status_code}"
        )

    def test_m4_store_owner_cannot_access_settings(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Store owners (non-superadmins) must not access platform settings.
        Expected result: 403
        """
        owner = make_user(db, email="m4-owner@test.com", is_superadmin=False)
        make_store(db, owner, slug="m4-owner-store")

        resp = client.get(SETTINGS_URL, headers=auth_headers(owner))
        assert resp.status_code == 403, (
            f"FAIL [M4]: Store owner accessed platform settings — "
            f"status={resp.status_code}"
        )

    def test_m4_superadmin_can_access_settings(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Superadmin can access settings (required for management).
        Expected result: 200
        """
        admin = make_user(db, email="m4-admin@test.com", is_superadmin=True)

        resp = client.get(SETTINGS_URL, headers=auth_headers(admin))
        assert resp.status_code == 200, (
            f"FAIL: Superadmin cannot access platform settings — "
            f"status={resp.status_code}"
        )

    def test_m4_real_value_not_in_response(self, client: TestClient, db: Session):
        """
        Objective: The `real_value` field must not appear in GET /platform-settings.
        Superadmins should receive masked values only; real values require a
        separate, audited endpoint with additional confirmation.
        Steps:
          1. Store an OpenAI API key via service layer
          2. GET /platform-settings as superadmin
          3. Verify the real key is NOT in any response item
        Expected result (post-patch): real_value is "" or absent from response.
        Expected result (pre-patch): real_value contains decrypted API key.
        """
        admin = make_user(db, email="m4-real-val@test.com", is_superadmin=True)

        # Store a fake API key
        fake_api_key = "sk-fake-openai-key-abcdef1234567890"
        update_setting(db, "openai_api_key", fake_api_key)

        resp = client.get(SETTINGS_URL, headers=auth_headers(admin))
        assert resp.status_code == 200

        settings = resp.json()
        openai_setting = next(
            (s for s in settings if s.get("key") == "openai_api_key"), None
        )

        if openai_setting:
            real_val = openai_setting.get("real_value", "")
            assert real_val != fake_api_key, (
                f"FAIL [M4]: real_value exposes decrypted API key in response. "
                f"Remove 'real_value' field from SettingItem response schema. "
                f"Exposed value: {real_val[:10]}..."
            )

    def test_m4_jwt_secret_key_not_readable_via_api(
        self, client: TestClient, db: Session
    ):
        """
        Objective: The JWT secret_key stored in platform settings must NOT be
        readable via the API (even by superadmins). Exposing it allows token forgery.
        Steps:
          1. Store a custom secret_key via service
          2. GET /platform-settings as superadmin
          3. Verify secret_key real_value is not returned
        Expected result (post-patch): secret_key is excluded from the API response
          OR its real_value is always masked.
        """
        admin = make_user(db, email="m4-jwt-key@test.com", is_superadmin=True)

        # The secret_key is in PLATFORM_KEYS — this is the issue
        update_setting(db, "secret_key", "super-secret-jwt-signing-key-1234567890")

        resp = client.get(SETTINGS_URL, headers=auth_headers(admin))
        assert resp.status_code == 200

        settings = resp.json()
        secret_setting = next(
            (s for s in settings if s.get("key") == "secret_key"), None
        )

        if secret_setting:
            real_val = secret_setting.get("real_value", "")
            assert "super-secret-jwt-signing-key" not in real_val, (
                f"FAIL [M4]: JWT secret_key is readable via platform-settings API. "
                f"Remove secret_key from PLATFORM_KEYS (it must not be API-managed) "
                f"or ensure real_value is never returned."
            )

    def test_m4_unauthenticated_settings_access_blocked(self, client: TestClient):
        """
        Objective: Unauthenticated access to platform settings must be blocked.
        Expected result: 401
        """
        resp = client.get(SETTINGS_URL)
        assert resp.status_code == 401, (
            f"FAIL: Settings accessible without auth — status={resp.status_code}"
        )


class TestFernetKeyBootstrap:
    """
    M4 + C4 chained: If SECRET_KEY is the default "change-me-in-production",
    the Fernet key is deterministic and all stored secrets can be decrypted
    offline without database access — only the encrypted values are needed.
    """

    def test_fernet_key_not_derived_from_default_secret(self):
        """
        Objective: Verify the Fernet encryption key is NOT derived from the
        default SECRET_KEY value.
        Expected result (post-patch): SECRET_KEY has no default; startup
          fails if not set.
        Expected result (pre-patch): Fernet key is trivially derivable.
        """
        from app.config import get_settings
        settings = get_settings()

        assert settings.secret_key != "change-me-in-production", (
            "FAIL [C4/M4]: SECRET_KEY is using the default 'change-me-in-production'. "
            "The Fernet encryption key for platform secrets is derived from this value, "
            "making ALL stored secrets trivially decryptable offline. "
            "Remove the default value from config.py."
        )

    def test_fernet_encrypted_value_is_not_plaintext(self, db: Session):
        """
        Objective: Values stored as is_secret=True must be encrypted at rest.
        Expected result: DB row value is NOT plaintext.
        """
        plaintext = "sk-fake-key-12345678901234567890"
        update_setting(db, "openai_api_key", plaintext)

        setting = db.query(PlatformSetting).filter(
            PlatformSetting.key == "openai_api_key"
        ).first()

        assert setting is not None
        assert setting.value != plaintext, (
            "FAIL [M4]: Secret stored as plaintext in database"
        )
        # Must be decryptable
        decrypted = decrypt_value(setting.value)
        assert decrypted == plaintext, (
            "FAIL [M4]: Stored encrypted value cannot be decrypted"
        )

    def test_fernet_offline_decryption_with_known_key(self):
        """
        Objective: Demonstrate that an attacker who knows SECRET_KEY can decrypt
        all platform settings without an API call.
        This is the C4 + M4 kill chain.
        Expected result: This test PASSES (demonstrating the attack works) if
          SECRET_KEY is default. After patching, SECRET_KEY should not be default.
        """
        from app.config import get_settings
        settings = get_settings()

        if settings.secret_key == "change-me-in-production":
            import base64
            import hashlib
            from cryptography.fernet import Fernet

            # Attacker reconstructs the key offline
            secret = b"change-me-in-production"
            key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
            attacker_fernet = Fernet(key)

            # Simulate attacker has extracted encrypted value from DB dump
            plaintext = "sk-sensitive-openai-key-abc123"
            encrypted = encrypt_value(plaintext)

            # Attacker decrypts
            recovered = attacker_fernet.decrypt(encrypted.encode()).decode()

            pytest.fail(
                f"FAIL [C4+M4 KILL CHAIN]: Attacker successfully decrypted platform "
                f"secret offline using default SECRET_KEY. "
                f"Recovered value matches: {recovered == plaintext}. "
                "Set a strong, random SECRET_KEY with no default."
            )


class TestSettingsUpdateSecurity:
    """
    Tests for the PATCH /platform-settings endpoint.
    """

    def test_settings_update_requires_superadmin(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Non-superadmins cannot update platform settings.
        Expected result: 403
        """
        user = make_user(db, email="upd-regular@test.com")

        resp = client.patch(
            SETTINGS_URL,
            headers=auth_headers(user),
            json={"settings": {"openai_api_key": "attacker-key"}},
        )
        assert resp.status_code == 403, (
            f"FAIL [M4]: Regular user updated platform settings — "
            f"status={resp.status_code}"
        )

    def test_settings_update_rejects_unknown_keys(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Unknown/arbitrary setting keys should be rejected or ignored.
        Expected result: 400 or 0 rows updated for unknown keys.
        """
        admin = make_user(db, email="upd-admin@test.com", is_superadmin=True)

        resp = client.patch(
            SETTINGS_URL,
            headers=auth_headers(admin),
            json={"settings": {"__proto__": "polluted", "constructor": "hijacked"}},
        )
        # Should either reject with 400 or silently ignore unknown keys
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("updated", 0) == 0, (
                "FAIL [M4]: Unknown/prototype-pollution keys were saved to platform settings"
            )
