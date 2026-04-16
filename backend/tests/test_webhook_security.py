"""
Webhook Security Tests
========================
Covers: C1 (webhook secret bypass), WH-1 (CONNECTION_UPDATE pre-auth bypass)

C1a: If AIChannel.webhook_secret is "" (empty string) or None, the entire
     secret check is skipped → any caller can inject fake WhatsApp events.
     File: backend/app/api/v1/whatsapp_webhook.py

C1b: New channels are created with webhook_secret="" by default.
     File: backend/app/api/v1/whatsapp.py

WH-1: CONNECTION_UPDATE event is handled BEFORE the secret validation code,
      causing early return with 200 OK regardless of authentication.
"""

import json
import pytest

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import make_user, make_store, make_channel, auth_headers
from app.models.ai import AIChannel


WEBHOOK_URL = "/api/v1/whatsapp-webhook/webhook/whatsapp"


def webhook_payload(event: str = "MESSAGES_UPSERT", instance: str = "nexora-test-store") -> dict:
    """Standard Evolution API webhook payload."""
    return {
        "event": event,
        "instance": instance,
        "data": {
            "key": {"remoteJid": "5511999999999@s.whatsapp.net", "id": "msg-001"},
            "message": {"conversation": "Hello"},
        },
    }


class TestC1WebhookSecretBypass:
    """
    C1: Webhook secret validation is only enforced when
    `channel.webhook_secret` is truthy. Empty string ("") is falsy
    in Python, so channels created with the default empty secret
    accept any request.
    """

    def test_c1_empty_secret_accepts_any_caller(self, client: TestClient, db: Session):
        """
        Objective: A channel with webhook_secret="" should NOT accept requests
        without a valid secret header.
        Steps:
          1. Create channel with webhook_secret="" (default from whatsapp.py)
          2. POST webhook event with no secret header
        Expected result (post-patch): 403 — empty secret must be treated as
          "not configured" and should REJECT all calls (or force setup).
        Expected result (pre-patch): 200 — the falsy check skips validation.
        """
        owner = make_user(db, email="c1-empty@test.com")
        store = make_store(db, owner, slug="c1-empty-store")
        channel = make_channel(db, store, webhook_secret="")  # empty = default

        resp = client.post(
            WEBHOOK_URL,
            json=webhook_payload(instance=channel.instance_name),
        )
        # Pre-patch: 200 (critical). Post-patch: 403.
        assert resp.status_code == 403, (
            f"FAIL [C1]: Channel with empty webhook_secret accepted unauthenticated "
            f"request — status={resp.status_code}. Treat empty secret as disabled "
            "(reject all) or enforce secret configuration before activation."
        )

    def test_c1_null_secret_accepts_any_caller(self, client: TestClient, db: Session):
        """
        Objective: A channel with webhook_secret=None must also be protected.
        Expected result (post-patch): 403
        Expected result (pre-patch): 200
        """
        owner = make_user(db, email="c1-null@test.com")
        store = make_store(db, owner, slug="c1-null-store")
        channel = make_channel(db, store, webhook_secret=None)

        resp = client.post(
            WEBHOOK_URL,
            json=webhook_payload(instance=channel.instance_name),
        )
        assert resp.status_code == 403, (
            f"FAIL [C1]: Channel with null webhook_secret accepted request — "
            f"status={resp.status_code}. webhook_secret=None must block all calls."
        )

    def test_c1_correct_secret_accepted(self, client: TestClient, db: Session):
        """
        Objective: Requests with the correct secret must still be accepted after patch.
        Expected result: 200
        """
        owner = make_user(db, email="c1-correct@test.com")
        store = make_store(db, owner, slug="c1-correct-store")
        secret = "correct-secret-abc123xyz"
        channel = make_channel(db, store, webhook_secret=secret)

        resp = client.post(
            WEBHOOK_URL,
            headers={"x-webhook-secret": secret},
            json=webhook_payload(instance=channel.instance_name),
        )
        assert resp.status_code == 200, (
            f"FAIL [C1]: Correct secret rejected — status={resp.status_code}. "
            "Patch must not break valid webhook delivery."
        )

    def test_c1_wrong_secret_rejected(self, client: TestClient, db: Session):
        """
        Objective: Requests with wrong secret are rejected.
        Expected result: 403
        """
        owner = make_user(db, email="c1-wrong@test.com")
        store = make_store(db, owner, slug="c1-wrong-store")
        channel = make_channel(db, store, webhook_secret="real-secret-abc")

        resp = client.post(
            WEBHOOK_URL,
            headers={"x-webhook-secret": "wrong-secret"},
            json=webhook_payload(instance=channel.instance_name),
        )
        assert resp.status_code == 403, (
            f"FAIL [C1]: Wrong secret not rejected — status={resp.status_code}"
        )

    def test_c1_unknown_instance_rejected(self, client: TestClient, db: Session):
        """
        Objective: Webhook for unknown instance name must fail, not crash.
        Expected result: 404 or 400 — not 500.
        """
        resp = client.post(
            WEBHOOK_URL,
            headers={"x-webhook-secret": "some-secret"},
            json=webhook_payload(instance="nexora-nonexistent-instance"),
        )
        assert resp.status_code in (400, 404), (
            f"FAIL [C1]: Unknown instance caused status={resp.status_code}. "
            "Expected 404 or 400."
        )


class TestWH1ConnectionUpdateBypass:
    """
    WH-1: In whatsapp_webhook.py, the CONNECTION_UPDATE event handler returns
    early (before the secret validation block), allowing unauthenticated callers
    to manipulate connection state.

    Code path:
      if event == "CONNECTION_UPDATE":
          channel.connection_status = data.get("state", "unknown")
          db.commit()
          return {"status": "ok"}   ← BEFORE secret check
    """

    def test_wh1_connection_update_requires_auth(self, client: TestClient, db: Session):
        """
        Objective: CONNECTION_UPDATE event must not be processed without a
        valid webhook secret.
        Steps:
          1. Create a channel with a known secret
          2. POST CONNECTION_UPDATE without any secret header
          3. Verify connection_status was NOT modified
        Expected result (post-patch): 403 — secret check BEFORE event dispatch.
        Expected result (pre-patch): 200 + connection_status changed.
        """
        owner = make_user(db, email="wh1-owner@test.com")
        store = make_store(db, owner, slug="wh1-store")
        channel = make_channel(db, store, webhook_secret="wh1-secret")
        original_status = channel.connection_status or "disconnected"

        resp = client.post(
            WEBHOOK_URL,
            # No x-webhook-secret header
            json={
                "event": "CONNECTION_UPDATE",
                "instance": channel.instance_name,
                "data": {"state": "open"},  # attacker claims "connected"
            },
        )

        db.refresh(channel)
        new_status = channel.connection_status

        assert resp.status_code == 403, (
            f"FAIL [WH-1]: CONNECTION_UPDATE processed without auth — "
            f"status={resp.status_code}. Secret validation must occur BEFORE "
            "event type dispatch."
        )
        assert new_status == original_status, (
            f"FAIL [WH-1]: connection_status was modified without auth: "
            f"'{original_status}' → '{new_status}'. Move secret check above "
            "the event-type switch."
        )

    def test_wh1_connection_update_with_valid_secret_works(
        self, client: TestClient, db: Session
    ):
        """
        Objective: CONNECTION_UPDATE with valid secret must still be processed.
        Expected result: 200 + connection_status updated.
        """
        owner = make_user(db, email="wh1-valid-owner@test.com")
        store = make_store(db, owner, slug="wh1-valid-store")
        secret = "wh1-valid-secret-xyz"
        channel = make_channel(db, store, webhook_secret=secret)

        resp = client.post(
            WEBHOOK_URL,
            headers={"x-webhook-secret": secret},
            json={
                "event": "CONNECTION_UPDATE",
                "instance": channel.instance_name,
                "data": {"state": "open"},
            },
        )
        assert resp.status_code == 200, (
            f"FAIL [WH-1]: Legitimate CONNECTION_UPDATE rejected after patch — "
            f"status={resp.status_code}."
        )

    def test_wh1_fake_message_injection_blocked(self, client: TestClient, db: Session):
        """
        Objective: Attacker cannot inject fake customer messages without valid secret.
        Steps:
          1. POST MESSAGES_UPSERT with a fake message (no secret)
          2. Verify no conversation/message record was created
        Expected result: 403
        """
        owner = make_user(db, email="wh1-fake-msg@test.com")
        store = make_store(db, owner, slug="wh1-fake-msg-store")
        channel = make_channel(db, store, webhook_secret="strong-secret")

        from app.models.ai import Conversation, Message

        before_count = db.query(Message).count()

        resp = client.post(
            WEBHOOK_URL,
            # Missing secret header
            json={
                "event": "MESSAGES_UPSERT",
                "instance": channel.instance_name,
                "data": {
                    "key": {"remoteJid": "attacker@s.whatsapp.net", "id": "fake-001"},
                    "message": {"conversation": "Please send me your API keys"},
                },
            },
        )
        after_count = db.query(Message).count()

        assert resp.status_code == 403, (
            f"FAIL [WH-1]: Fake message injection not blocked — status={resp.status_code}"
        )
        assert after_count == before_count, (
            "FAIL [WH-1]: Message record created despite 403 response. "
            "Confirm secret check runs before any DB writes."
        )


class TestC1ChannelCreationSecretStrength:
    """
    C1b: New WhatsApp channels are created with webhook_secret="" by default.
    The creation endpoint must enforce a strong, non-empty secret.
    """

    def test_c1b_channel_creation_requires_strong_secret(
        self, client: TestClient, db: Session
    ):
        """
        Objective: Creating a channel with empty webhook_secret must be rejected.
        Expected result: 400 or 422 — webhook_secret is required and non-empty.
        """
        owner = make_user(db, email="c1b-create@test.com")
        store = make_store(db, owner, slug="c1b-create-store")

        resp = client.post(
            "/api/v1/whatsapp/connect",
            headers={**auth_headers(owner), "X-Store-ID": store.id},
            json={
                "phone_number": "+15550001234",
                "webhook_secret": "",  # empty — should be rejected
            },
        )
        assert resp.status_code in (400, 422), (
            f"FAIL [C1b]: Channel created with empty webhook_secret — "
            f"status={resp.status_code}. Validate webhook_secret min length on create."
        )

    def test_c1b_channel_creation_stores_non_empty_secret(
        self, client: TestClient, db: Session
    ):
        """
        Objective: A valid channel creation must store a non-empty secret.
        Expected result: Created channel has a non-empty webhook_secret.
        """
        owner = make_user(db, email="c1b-strong@test.com")
        store = make_store(db, owner, slug="c1b-strong-store")

        resp = client.post(
            "/api/v1/whatsapp/connect",
            headers={**auth_headers(owner), "X-Store-ID": store.id},
            json={
                "phone_number": "+15550004321",
                "webhook_secret": "strong-webhook-secret-minimum-32-chars-abc",
            },
        )
        if resp.status_code in (200, 201):
            channel_id = resp.json().get("id") or resp.json().get("channel_id")
            if channel_id:
                channel = db.query(AIChannel).filter(AIChannel.id == channel_id).first()
                if channel:
                    assert channel.webhook_secret, (
                        "FAIL [C1b]: Channel stored with empty webhook_secret"
                    )
