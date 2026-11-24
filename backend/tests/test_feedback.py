"""Feedback: anyone with a session can send it; the owner's inbox shows only the owner account's
notes (visitors' notes reach Sergio by email and scripts/feedback.py); it lives outside demos."""

import pytest
from fastapi.testclient import TestClient

from app import db

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def send(client: TestClient, text: str = "The list is slow", page: str = "List", photos=()):
    return client.post("/api/feedback", json={"text": text, "page": page, "photos": list(photos)})


def upload(client: TestClient) -> str:
    files = {"photo": ("p.jpg", JPEG), "thumb": ("t.jpg", JPEG)}
    return client.post("/api/photos", files=files).json()["photoKey"]


def test_owner_and_guest_can_send_but_the_inbox_shows_only_the_owners(client, guest):
    assert send(client, "Owner idea", "Pantry").status_code == 201
    sent = send(guest, "  Guest idea  ", "Welcome").json()
    assert sent["role"] == "guest" and sent["text"] == "Guest idea" and sent["status"] == "new"
    inbox = client.get("/api/feedback").json()
    assert [(f["text"], f["role"], f["page"]) for f in inbox] == [("Owner idea", "owner", "Pantry")]
    # Still stored, for Sergio's script.
    assert len(db.query("feedback", "FEEDBACK#")) == 2


def test_the_inbox_is_newest_first(client):
    for n in range(3):
        db.put("feedback", f"FEEDBACK#2026-11-2{n}T10:00:00+00:00#id{n}", {
            "id": f"id{n}", "text": f"note {n}", "role": "owner", "createdAt": f"2026-11-2{n}T10:00:00+00:00",
        })
    assert [f["id"] for f in client.get("/api/feedback").json()] == ["id2", "id1", "id0"]


def test_without_a_session_or_too_long_it_is_refused(anon, client):
    assert send(anon).status_code == 401
    assert send(client, "x" * 2001).status_code == 422
    assert send(client, "").status_code == 422


def test_guests_cannot_read_or_mark_feedback(client, guest):
    sent = send(client).json()
    assert guest.get("/api/feedback").status_code == 403
    assert guest.patch(f"/api/feedback/{sent['id']}", json={"status": "done"}).status_code == 404
    own = send(guest).json()
    assert guest.patch(f"/api/feedback/{own['id']}", json={"status": "done"}).status_code == 403


def test_the_owner_marks_feedback_done_and_back(client):
    sent = send(client).json()
    assert client.patch(f"/api/feedback/{sent['id']}", json={"status": "done"}).json()["status"] == "done"
    assert client.get("/api/feedback").json()[0]["status"] == "done"
    assert client.patch(f"/api/feedback/{sent['id']}", json={"status": "new"}).json()["status"] == "new"
    assert client.patch("/api/feedback/nope", json={"status": "done"}).status_code == 404


def test_the_owner_cannot_touch_visitors_notes(client, guest):
    sent = send(guest).json()
    assert client.patch(f"/api/feedback/{sent['id']}", json={"status": "done"}).status_code == 404
    assert client.patch(f"/api/feedback/{sent['id']}", json={"text": "changed"}).status_code == 404


def test_the_writer_can_fix_the_text_and_nobody_else(client, guest, anon):
    sent = send(guest, "Teh list").json()
    fixed = guest.patch(f"/api/feedback/{sent['id']}", json={"text": "The list"}).json()
    assert fixed["text"] == "The list" and fixed["editedAt"]
    anon.post("/api/session/guest")
    assert anon.patch(f"/api/feedback/{sent['id']}", json={"text": "hacked"}).status_code == 404
    mine = send(client, "Owner typo").json()
    assert client.patch(f"/api/feedback/{mine['id']}", json={"text": "Owner fixed"}).json()["text"] == "Owner fixed"


def test_sending_is_rate_limited_per_network(guest):
    for _ in range(10):
        assert send(guest).status_code == 201
    assert send(guest).status_code == 429


def test_only_guest_feedback_logs_the_alarm_line(client, guest, caplog: pytest.LogCaptureFixture):
    send(client)
    assert "Guest feedback received" not in caplog.text
    send(guest)
    assert "Guest feedback received" in caplog.text


def test_feedback_outlives_demos_and_is_never_copied_into_one(client, anon):
    send(client, "Owner only")
    anon.post("/api/session/guest")
    rows = db.get_table().scan()["Items"]
    assert not any(r["pk"].startswith("SPACE#sb-") and r["sk"].startswith("FEEDBACK#") for r in rows)
    assert all("ttl" not in r for r in rows if r["pk"] == "SPACE#feedback")


def test_screenshots_are_kept_and_only_the_owner_can_open_them(client, guest):
    sent = send(client, "Look", photos=[upload(client)]).json()
    assert sent["photos"] == [f"feedback/{sent['id']}-0"] and "space" not in sent
    assert client.get(f"/api/photos/{sent['photos'][0]}").status_code == 200
    assert client.get(f"/api/photos/{sent['photos'][0]}?size=thumb").status_code == 200
    assert guest.get(f"/api/photos/{sent['photos'][0]}").status_code == 404
    # A guest's screenshot is kept too (for Sergio's script).
    from_guest = send(guest, "Mine", photos=[upload(guest)]).json()
    assert from_guest["photos"] == [f"feedback/{from_guest['id']}-0"]


def test_only_photos_from_the_senders_own_space(client, guest):
    assert send(guest, "x", photos=[upload(client)]).status_code == 400
    assert send(client, "x", photos=["main/missing"]).status_code == 400
