"""
Test configuration and shared fixtures for Nexora security test suite.
Uses SQLite in-memory database to avoid requiring a live PostgreSQL instance.
"""

import json
import os
import pytest
from datetime import datetime, timezone
from typing import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Override settings BEFORE importing app modules
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-security-tests-only-32c")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_security.db")
os.environ.setdefault("FRONTEND_URL", "http://localhost:3000")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

from app.db.session import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.models.store import Store, StoreMember
from app.models.product import Product
from app.models.ai import AIChannel, AIAgent, Conversation, Message
from app.models.sales_session import SalesSession, EMPTY_NOTEBOOK
from app.models.platform_settings import PlatformSetting
from app.core.security import create_access_token, create_refresh_token

# Use a fast, bcrypt-free hash for tests to avoid passlib/bcrypt version conflicts
import hashlib as _hashlib

def _test_password_hash(password: str) -> str:
    """SHA256-based stub hash for tests only. Never use in production."""
    return "sha256$" + _hashlib.sha256(password.encode()).hexdigest()

def _test_verify_password(plain: str, hashed: str) -> bool:
    return hashed == _test_password_hash(plain)

# Patch passlib-based functions before any test runs
import unittest.mock as _mock
import app.core.security as _security_module
_security_module.get_password_hash = _test_password_hash
_security_module.verify_password = _test_verify_password

def get_password_hash(password: str) -> str:
    return _test_password_hash(password)

# ── In-memory SQLite engine ──────────────────────────────────────────────────

SQLALCHEMY_TEST_URL = "sqlite:///./test_security.db"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once per test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    import pathlib
    db_file = pathlib.Path("./test_security.db")
    if db_file.exists():
        db_file.unlink()


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    """Fresh DB transaction per test — rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db: Session) -> TestClient:
    """FastAPI TestClient with overridden DB dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Shared entity factories ──────────────────────────────────────────────────

def make_user(
    db: Session,
    email: str = "user@test.com",
    password: str = "TestPass123!",
    is_superadmin: bool = False,
    is_active: bool = True,
) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name="Test User",
        is_active=is_active,
        is_superadmin=is_superadmin,
        auth_provider="email",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_store(
    db: Session,
    owner: User,
    slug: str = "test-store",
    is_active: bool = True,
) -> Store:
    store = Store(
        name="Test Store",
        slug=slug,
        is_active=is_active,
        currency="USD",
        language="en",
    )
    db.add(store)
    db.commit()
    db.refresh(store)

    membership = StoreMember(
        store_id=store.id,
        user_id=owner.id,
        role="owner",
    )
    db.add(membership)
    db.commit()
    return store


def make_product(
    db: Session,
    store: Store,
    name: str = "Test Product",
    price: float = 99.99,
    is_active: bool = True,
    stock: int = 10,
) -> Product:
    product = Product(
        store_id=store.id,
        name=name,
        price=price,
        is_active=is_active,
        stock=stock,
        status="active",
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def make_channel(
    db: Session,
    store: Store,
    webhook_secret: str = "strong-secret-abc123",
    channel_type: str = "whatsapp",
) -> AIChannel:
    channel = AIChannel(
        store_id=store.id,
        channel_type=channel_type,
        is_active=True,
        instance_name=f"nexora-{store.slug}",
        webhook_secret=webhook_secret,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return channel


def get_token(user: User) -> str:
    return create_access_token(
        subject=user.id,
        extra_claims={"email": user.email},
    )


def auth_headers(user: User) -> dict:
    return {"Authorization": f"Bearer {get_token(user)}"}
