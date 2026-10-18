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
    assert anon.post("/api/session/owner", json={"passcode": "0000"}).status_code == 401
    assert anon.post("/api/session/owner", json={"passcode": "12345"}).status_code == 422
    assert anon.post("/api/session/owner", json={"passcode": "abcd"}).status_code == 422
    assert anon.get("/api/session").json()["role"] is None


def test_login_is_throttled_per_ip(anon):
    for _ in range(5):
        assert anon.post("/api/session/owner", json={"passcode": "0000"}).status_code == 401
    # Even the right code is refused while throttled.
    response = anon.post("/api/session/owner", json={"passcode": OWNER_PASSCODE})
    assert response.status_code == 429


def test_login_disabled_without_passcode(anon, monkeypatch):
    monkeypatch.delenv("PASSCODE_HASH")
    assert anon.get("/api/session").json()["ownerLoginEnabled"] is False
    assert anon.post("/api/session/owner", json={"passcode": "1234"}).status_code == 503


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
    # The guest's sandbox was copied before Rice existed.
    assert names(guest) == []

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
    assert names(other) == []


def test_sandbox_rows_expire_and_owner_rows_do_not(client, guest):
    client.post("/api/items", json={"name": "Rice"})
    guest.post("/api/items", json={"name": "Guest snack"})
    rows = db.get_table().scan()["Items"]
    for row in rows:
        if row["pk"] == "SPACE#main":
            assert "ttl" not in row
        elif row["pk"].startswith("SPACE#sb-"):
            assert int(row["ttl"]) > time.time()


def test_starting_a_demo_twice_keeps_the_same_sandbox(guest):
    guest.post("/api/items", json={"name": "Mine"})
    guest.post("/api/session/guest")
    assert names(guest) == ["Mine"]


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
