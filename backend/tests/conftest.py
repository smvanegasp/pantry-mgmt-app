import os

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from app import db
from app.main import app


@pytest.fixture(autouse=True)
def aws():
    """Every test gets a fresh, in-memory DynamoDB table."""
    os.environ.update(
        AWS_ACCESS_KEY_ID="test",
        AWS_SECRET_ACCESS_KEY="test",
        AWS_REGION="us-east-1",
        TABLE_NAME="pantry-test",
    )
    os.environ.pop("DYNAMODB_ENDPOINT", None)
    with mock_aws():
        db.get_table.cache_clear()
        db.create_table_if_missing()
        yield
    db.get_table.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
