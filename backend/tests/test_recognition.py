import json

import httpx
import pytest

from app import recognize
from tests.test_photos import upload


@pytest.fixture
def model(monkeypatch):
    """Stand-in for the Gemini call: records prompts and returns a canned answer."""
    calls = []
    answer = {
        "isProduct": True,
        "name": "Barilla spaghetti",
        "categoryName": "Grains & pasta",
        "mode": "count",
        "count": 2,
        "expiresOn": "2028-09-30",
    }

    def fake(image, mime_type, prompt):
        calls.append({"image": image, "mime_type": mime_type, "prompt": prompt})
        return dict(answer)

    monkeypatch.setattr(recognize, "call_model", fake)
    fake.calls = calls
    fake.answer = answer
    return fake


def photo(client):
    return upload(client).json()["photoKey"]


def test_recognizes_a_photo_and_matches_an_existing_category(client, model):
    cat = client.post("/api/categories", json={"name": "Grains & Pasta"}).json()
    key = photo(client)

    result = client.post("/api/recognize", json={"photoKey": key})

    assert result.status_code == 200
    assert result.json() == {
        "isProduct": True,
        "name": "Barilla spaghetti",
        "categoryId": cat["id"],
        "newCategoryName": None,
        "mode": "count",
        "count": 2,
        "expiresOn": "2028-09-30",
    }
    [call] = model.calls
    assert call["mime_type"] == "image/jpeg"
    assert "Grains & Pasta" in call["prompt"]


def test_suggests_a_new_category_when_none_matches(client, model):
    model.answer["categoryName"] = "Condiments"
    result = client.post("/api/recognize", json={"photoKey": photo(client)}).json()
    assert result["categoryId"] is None
    assert result["newCategoryName"] == "Condiments"


def test_count_only_applies_to_count_items(client, model):
    model.answer.update(mode="level", count=3)
    assert client.post("/api/recognize", json={"photoKey": photo(client)}).json()["count"] is None


def test_unusable_model_answer_is_a_502(client, model):
    model.answer["mode"] = "some"
    assert client.post("/api/recognize", json={"photoKey": photo(client)}).status_code == 502


def test_missing_key_is_a_503(client, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert client.post("/api/recognize", json={"photoKey": photo(client)}).status_code == 503


@pytest.mark.parametrize("key_var", ["OPENAI_API_KEY", "GEMINI_API_KEY"])
def test_provider_errors_are_502_and_never_leak_the_key(client, monkeypatch, key_var):
    monkeypatch.setenv(key_var, "secret-key-123")

    def fail(url, headers, **kwargs):
        request = httpx.Request("POST", url, headers=headers)
        raise httpx.HTTPStatusError("402", request=request, response=httpx.Response(402, request=request))

    monkeypatch.setattr(recognize.httpx, "post", fail)
    response = client.post("/api/recognize", json={"photoKey": photo(client)})
    assert response.status_code == 502
    assert "secret-key-123" not in response.text


def fake_post(payload):
    """Stand-in for httpx.post that records the request and returns `payload`."""
    sent = {}

    def post(url, headers, json, timeout):
        sent.update(url=url, headers=headers, body=json)
        return httpx.Response(200, json=payload, request=httpx.Request("POST", url))

    post.sent = sent
    return post


ANSWER = {
    "isProduct": True,
    "name": "Barilla spaghetti",
    "categoryName": None,
    "mode": "count",
    "count": 1,
    "expiresOn": "2028-09-30",
}


def test_openai_request_and_response_shape(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "ignored-when-openai-is-set")
    post = fake_post(
        {
            "output": [
                {"type": "reasoning", "summary": []},
                {"type": "message", "content": [{"type": "output_text", "text": json.dumps(ANSWER)}]},
            ]
        }
    )
    monkeypatch.setattr(recognize.httpx, "post", post)

    result = client.post("/api/recognize", json={"photoKey": photo(client)}).json()

    assert result["name"] == "Barilla spaghetti"
    assert post.sent["url"] == "https://api.openai.com/v1/responses"
    assert post.sent["headers"] == {"Authorization": "Bearer sk-test"}
    body = post.sent["body"]
    assert body["model"] == "gpt-6-luna"
    assert body["text"]["format"]["strict"] is True
    image = body["input"][0]["content"][1]
    assert image["type"] == "input_image"
    assert image["image_url"].startswith("data:image/jpeg;base64,")


def test_gemini_is_used_when_only_its_key_is_set(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "g-test")
    post = fake_post({"candidates": [{"content": {"parts": [{"text": json.dumps(ANSWER)}]}}]})
    monkeypatch.setattr(recognize.httpx, "post", post)

    assert client.post("/api/recognize", json={"photoKey": photo(client)}).status_code == 200
    assert "generativelanguage.googleapis.com" in post.sent["url"]


def test_photo_must_exist_and_be_readable(client, guest, model):
    assert client.post("/api/recognize", json={"photoKey": f"main/{'0' * 32}"}).status_code == 404
    guest_key = photo(guest)
    # The owner can't read a guest's sandbox photo, so can't have it recognized either.
    assert client.post("/api/recognize", json={"photoKey": guest_key}).status_code == 404
    assert model.calls == []


def test_needs_a_session(anon, model):
    assert anon.post("/api/recognize", json={"photoKey": f"main/{'0' * 32}"}).status_code == 401


def test_guests_are_capped_per_day(guest, model):
    key = photo(guest)
    for _ in range(20):
        assert guest.post("/api/recognize", json={"photoKey": key}).status_code == 200
    assert guest.post("/api/recognize", json={"photoKey": key}).status_code == 429
