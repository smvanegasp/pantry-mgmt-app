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


def test_provider_errors_are_502_and_never_leak_the_key(client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "secret-key-123")

    def fail(*args, **kwargs):
        request = httpx.Request("POST", "https://example.test", headers={"x-goog-api-key": "secret-key-123"})
        raise httpx.HTTPStatusError("402", request=request, response=httpx.Response(402, request=request))

    monkeypatch.setattr(recognize.httpx, "post", fail)
    response = client.post("/api/recognize", json={"photoKey": photo(client)})
    assert response.status_code == 502
    assert "secret-key-123" not in response.text


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
