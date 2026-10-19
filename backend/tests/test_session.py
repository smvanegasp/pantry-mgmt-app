import time

from fastapi.testclient import TestClient

from app import db, sandbox
from app.main import app
from app.session import COOKIE
from tests.conftest import OWNER_PASSCODE


def names(client, path="/api/items"):
    return sorted(i["name"] for i in client.get(path).json())


# --- sessions -------------------------------------------------------------------------


def test_no_session_cannot_read_or_write(anon):
    assert anon.get("/api/session").json() == {
        "role": None,
        "expiresAt": None,
        "ownerLoginEnabled": True,
    }
    assert anon.get("/api/items").status_code == 401
    assert anon.post("/api/items", json={"name": "Rice"}).status_code == 401
    assert anon.get("/api/list").status_code == 401
    assert anon.get("/api/health").status_code == 200


def test_owner_login(anon):
    response = anon.post("/api/session/owner", json={"passcode": OWNER_PASSCODE})
    assert response.status_code == 200
    assert response.json()["role"] == "owner"
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert anon.get("/api/session").json()["role"] == "owner"
    assert anon.get("/api/items").status_code == 200


def test_wrong_or_malformed_passcode(anon):
    wrong = anon.post("/api/session/owner", json={"passcode": "000000"})
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "Wrong passcode. 2 tries left."
    # Six digits only (the old 4-digit codes are rejected too).
    for bad in ("1234", "12345", "1234567", "abcdef"):
        assert anon.post("/api/session/owner", json={"passcode": bad}).status_code == 422
    assert anon.get("/api/session").json()["role"] is None


def test_three_wrong_tries_pause_login_and_hide_the_button(anon):
    tries = [anon.post("/api/session/owner", json={"passcode": "000000"}) for _ in range(3)]
    assert [t.status_code for t in tries] == [401, 401, 429]
    assert tries[1].json()["detail"] == "Wrong passcode. 1 try left."
    assert "paused" in tries[2].json()["detail"]
    # Even the right code is refused while paused, and the app hides the login button.
    assert anon.post("/api/session/owner", json={"passcode": OWNER_PASSCODE}).status_code == 429
    assert anon.get("/api/session").json()["ownerLoginEnabled"] is False


def test_global_cap_pauses_login_everywhere(anon):
    # Wrong tries spread over many networks (each IP gets 3).
    for i in range(10):
        ip = f"203.0.113.{i // 3}:1234"
        anon.post("/api/session/owner", json={"passcode": "000000"}, headers={"cloudfront-viewer-address": ip})
    assert anon.get("/api/session").json()["ownerLoginEnabled"] is False
    fresh = anon.post(
        "/api/session/owner",
        json={"passcode": OWNER_PASSCODE},
        headers={"cloudfront-viewer-address": "198.51.100.7:1"},
    )
    assert fresh.status_code == 429


def test_login_disabled_without_passcode(anon, monkeypatch):
    monkeypatch.delenv("PASSCODE_HASH")
    assert anon.get("/api/session").json()["ownerLoginEnabled"] is False
    assert anon.post("/api/session/owner", json={"passcode": "123456"}).status_code == 503


def test_logout(client):
    assert client.delete("/api/session").json()["role"] is None
    assert client.get("/api/items").status_code == 401


def test_tampered_cookie_is_ignored(client):
    token = client.cookies[COOKIE]
    client.cookies.set(COOKIE, token[:-2] + "xx")
    assert client.get("/api/items").status_code == 401


def test_cookie_signed_with_another_secret_is_ignored(client, monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "a-different-secret")
    assert client.get("/api/items").status_code == 401


# --- guest sandboxes ------------------------------------------------------------------


def test_guest_gets_a_copy_of_the_owners_pantry(client, anon):
    cat = client.post("/api/categories", json={"name": "Grains"}).json()
    client.post("/api/items", json={"name": "Rice", "categoryId": cat["id"]})
    client.post("/api/list", json={"name": "Candles"})
    client.put("/api/settings", json={"buyWhenLevel": 50, "buyWhenCount": 2})

    info = anon.post("/api/session/guest").json()

    assert info["role"] == "guest"
    assert info["expiresAt"] > time.time() + 23 * 3600
    assert names(anon) == ["Rice"]
    assert [c["name"] for c in anon.get("/api/categories").json()] == ["Grains"]
    assert [e["name"] for e in anon.get("/api/list").json()] == ["Candles"]
    assert anon.get("/api/settings").json() == {"buyWhenLevel": 50, "buyWhenCount": 2}


def test_guest_changes_never_reach_the_owner(client, guest):
    client.post("/api/items", json={"name": "Rice"})
    # The guest's sandbox was created before Rice existed.
    assert "Rice" not in names(guest)

    guest_item = guest.post("/api/items", json={"name": "Guest snack"}).json()
    guest.put("/api/settings", json={"buyWhenLevel": 75, "buyWhenCount": 5})
    guest.post("/api/list", json={"name": "Guest entry"})

    assert names(client) == ["Rice"]
    assert client.get("/api/settings").json() == {"buyWhenLevel": 25, "buyWhenCount": 1}
    assert client.get("/api/list").json() == []
    assert client.get(f"/api/items/{guest_item['id']}").status_code == 404


def test_guest_cannot_touch_owner_rows_by_id(client, guest):
    rice = client.post("/api/items", json={"name": "Rice"}).json()
    assert guest.get(f"/api/items/{rice['id']}").status_code == 404
    assert guest.patch(f"/api/items/{rice['id']}", json={"name": "Hacked"}).status_code == 404
    assert guest.delete(f"/api/items/{rice['id']}").status_code == 404
    assert client.get(f"/api/items/{rice['id']}").json()["name"] == "Rice"


def test_guests_are_isolated_from_each_other(guest):
    other = TestClient(app)
    other.post("/api/session/guest")
    guest.post("/api/items", json={"name": "Mine"})
    assert "Mine" not in names(other)


def test_sandbox_rows_expire_and_owner_rows_do_not(client, guest):
    client.post("/api/items", json={"name": "Rice"})
    guest.post("/api/items", json={"name": "Guest snack"})
    rows = db.get_table().scan()["Items"]
    for row in rows:
        if row["pk"] == "SPACE#main":
            assert "ttl" not in row
        elif row["pk"].startswith("SPACE#sb-"):
            assert int(row["ttl"]) > time.time()


def test_demo_uses_sample_pantry_while_owner_pantry_is_empty(anon):
    anon.post("/api/session/guest")
    items = anon.get("/api/items").json()
    assert len(items) > 10
    assert {"Basmati rice", "Black beans", "Milk"} <= {i["name"] for i in items}
    assert len(anon.get("/api/categories").json()) >= 5
    # The sample shows off the features: low items, expiring items, multi-package items.
    assert any(len(i["packages"]) > 1 for i in items)
    assert len(anon.post("/api/list/generate").json()["added"]) >= 3


def test_sample_pantry_never_touches_owner_space(client, anon):
    anon.post("/api/session/guest")
    assert client.get("/api/items").json() == []
    assert client.get("/api/categories").json() == []


def test_demo_can_start_from_sample_even_when_owner_has_items(client, anon):
    client.post("/api/items", json={"name": "Her rice"})
    anon.post("/api/session/guest/reset?sample=true")
    item_names = names(anon)
    assert "Her rice" not in item_names
    assert "Basmati rice" in item_names


def test_starting_a_demo_twice_keeps_the_same_sandbox(guest):
    guest.post("/api/items", json={"name": "Mine"})
    guest.post("/api/session/guest")
    assert "Mine" in names(guest)


def test_reset_demo_starts_from_a_fresh_copy(client, guest):
    client.post("/api/items", json={"name": "Rice"})
    guest.post("/api/items", json={"name": "Mine"})

    guest.post("/api/session/guest/reset")

    assert names(guest) == ["Rice"]


def test_expired_sandbox_session_is_rejected(guest, monkeypatch):
    real_time = time.time
    monkeypatch.setattr(sandbox.time, "time", lambda: real_time() + 25 * 3600)
    assert guest.get("/api/items").status_code == 401
    assert guest.get("/api/session").json()["role"] is None


def test_guest_logging_in_switches_to_the_real_pantry(client, guest):
    client.post("/api/items", json={"name": "Rice"})
    guest.post("/api/items", json={"name": "Mine"})
    guest.post("/api/session/owner", json={"passcode": OWNER_PASSCODE})
    assert names(guest) == ["Rice"]


def test_sandbox_creation_is_rate_limited(anon):
    for _ in range(20):
        assert anon.post("/api/session/guest/reset").status_code == 200
    assert anon.post("/api/session/guest/reset").status_code == 429
