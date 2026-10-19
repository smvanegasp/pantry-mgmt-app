import os

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from app import db, storage
from app.main import app
from app.passcode import hash_passcode

OWNER_PASSCODE = "4821"
_HASH = hash_passcode(OWNER_PASSCODE)


@pytest.fixture(autouse=True)
def aws():
    """Every test gets a fresh, in-memory DynamoDB table."""
    os.environ.update(
        AWS_ACCESS_KEY_ID="test",
        AWS_SECRET_ACCESS_KEY="test",
        AWS_REGION="us-east-1",
        TABLE_NAME="pantry-test",
        SESSION_SECRET="test-secret",
        PASSCODE_HASH=_HASH,
        COOKIE_SECURE="0",
    )
    os.environ.pop("DYNAMODB_ENDPOINT", None)
    os.environ.pop("S3_ENDPOINT", None)
    # Tests must never call the real model (or spend money).
    os.environ.pop("GEMINI_API_KEY", None)
    with mock_aws():
        db.get_table.cache_clear()
        storage.get_s3.cache_clear()
        db.create_table_if_missing()
        storage.create_bucket_if_missing()
        yield
    db.get_table.cache_clear()
    storage.get_s3.cache_clear()


@pytest.fixture
def anon() -> TestClient:
    """A visitor with no session yet."""
    return TestClient(app)


@pytest.fixture
def client() -> TestClient:
    """Logged in as the owner, working on the real pantry."""
    c = TestClient(app)
    assert c.post("/api/session/owner", json={"passcode": OWNER_PASSCODE}).status_code == 200
    return c


@pytest.fixture
def guest() -> TestClient:
    """A visitor in their own demo sandbox."""
    c = TestClient(app)
    assert c.post("/api/session/guest").status_code == 200
    return c
