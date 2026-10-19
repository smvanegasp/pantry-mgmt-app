"""Behavior that only switches on when running on AWS (Lambda behind CloudFront)."""

import os

import boto3
import pytest
from fastapi.testclient import TestClient

from app import ssm
from app.config import session_secret
from app.main import app


@pytest.fixture
def aws_env():
    """Undo the environment changes these tests make."""
    saved = dict(os.environ)
    yield
    os.environ.clear()
    os.environ.update(saved)


def test_ssm_parameters_become_environment_variables(aws_env) -> None:
    client = boto3.client("ssm", region_name="us-east-1")
    client.put_parameter(Name="/pantry/GROQ_API_KEY", Value="from-ssm", Type="SecureString")
    client.put_parameter(Name="/pantry/SESSION_SECRET", Value="ignored", Type="SecureString")
    client.put_parameter(Name="/other/GEMINI_API_KEY", Value="not-mine", Type="SecureString")
    os.environ["SSM_PREFIX"] = "/pantry/"

    ssm.load_parameters()

    assert os.environ["GROQ_API_KEY"] == "from-ssm"
    # Variables that are already set win (conftest sets SESSION_SECRET).
    assert os.environ["SESSION_SECRET"] == "test-secret"
    assert "GEMINI_API_KEY" not in os.environ


def test_missing_session_secret_is_fatal_on_aws(aws_env) -> None:
    del os.environ["SESSION_SECRET"]
    os.environ["AWS_LAMBDA_FUNCTION_NAME"] = "pantry-api"
    with pytest.raises(RuntimeError):
        session_secret()


def test_only_cloudfront_may_call_the_api(aws_env) -> None:
    os.environ["ORIGIN_SECRET"] = "s3cret"
    client = TestClient(app)
    assert client.get("/api/health").status_code == 403
    assert client.get("/api/health", headers={"x-origin-verify": "wrong"}).status_code == 403
    assert client.get("/api/health", headers={"x-origin-verify": "s3cret"}).status_code == 200
