from app import storage
from app.routers.photos import object_keys

JPEG = b"\xff\xd8\xff\xe0" + b"fake-jpeg-body" * 10
THUMB = b"\xff\xd8\xff\xe0" + b"thumb"
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 20


def upload(client, photo=JPEG, thumb=THUMB):
    return client.post(
        "/api/photos",
        files={"photo": ("p.jpg", photo, "image/jpeg"), "thumb": ("t.jpg", thumb, "image/jpeg")},
    )


def stored(photo_key):
    full, thumb = object_keys(photo_key)
    return storage.get(full) is not None and storage.get(thumb) is not None


def test_upload_and_read_back(client):
    response = upload(client)
    assert response.status_code == 201
    key = response.json()["photoKey"]
    assert key.startswith("main/")

    full = client.get(f"/api/photos/{key}")
    assert full.status_code == 200
    assert full.content == JPEG
    assert full.headers["content-type"] == "image/jpeg"
    assert "immutable" in full.headers["cache-control"]
    assert client.get(f"/api/photos/{key}?size=thumb").content == THUMB


def test_png_is_accepted(client):
    assert upload(client, photo=PNG, thumb=PNG).status_code == 201


def test_non_images_are_rejected(client):
    assert upload(client, photo=b"#!/bin/sh\nrm -rf /").status_code == 415
    assert upload(client, thumb=b"<svg onload=alert(1)>").status_code == 415


def test_oversized_upload_is_rejected(client):
    huge = b"\xff\xd8\xff" + b"0" * (3 * 1024 * 1024)
    assert upload(client, photo=huge).status_code == 413


def test_photos_need_a_session(anon):
    assert upload(anon).status_code == 401


def test_item_with_photo(client):
    key = upload(client).json()["photoKey"]
    item = client.post("/api/items", json={"name": "Honey", "photoKey": key}).json()
    assert item["photoKey"] == key


def test_photo_key_must_be_well_formed(client):
    bad = {"name": "Honey", "photoKey": "../../etc/passwd"}
    assert client.post("/api/items", json=bad).status_code == 422


def test_replacing_a_photo_deletes_the_old_one(client):
    old = upload(client).json()["photoKey"]
    new = upload(client).json()["photoKey"]
    item = client.post("/api/items", json={"name": "Honey", "photoKey": old}).json()

    client.patch(f"/api/items/{item['id']}", json={"photoKey": new})

    assert not stored(old)
    assert stored(new)


def test_removing_photo_and_deleting_item_clean_up(client):
    first = upload(client).json()["photoKey"]
    item = client.post("/api/items", json={"name": "Honey", "photoKey": first}).json()
    client.patch(f"/api/items/{item['id']}", json={"photoKey": None})
    assert not stored(first)

    second = upload(client).json()["photoKey"]
    client.patch(f"/api/items/{item['id']}", json={"photoKey": second})
    client.delete(f"/api/items/{item['id']}")
    assert not stored(second)


def test_guest_sees_owner_photos_in_the_demo_copy(client, anon):
    key = upload(client).json()["photoKey"]
    client.post("/api/items", json={"name": "Honey", "photoKey": key})
    anon.post("/api/session/guest")

    [item] = anon.get("/api/items").json()

    assert item["photoKey"] == key
    assert anon.get(f"/api/photos/{key}").content == JPEG


def test_guest_can_never_delete_owner_photos(client, anon):
    key = upload(client).json()["photoKey"]
    client.post("/api/items", json={"name": "Honey", "photoKey": key})
    anon.post("/api/session/guest")
    [item] = anon.get("/api/items").json()

    guest_key = upload(anon).json()["photoKey"]
    anon.patch(f"/api/items/{item['id']}", json={"photoKey": guest_key})
    anon.delete(f"/api/items/{item['id']}")

    assert stored(key)
    assert client.get(f"/api/photos/{key}").status_code == 200


def test_guest_photos_go_in_the_sandbox_and_stay_private(client, guest):
    key = upload(guest).json()["photoKey"]
    assert key.startswith("sb-")
    assert guest.get(f"/api/photos/{key}").status_code == 200
    # Neither the owner nor another guest can read it.
    assert client.get(f"/api/photos/{key}").status_code == 404


def test_guest_photo_uploads_are_capped(guest):
    for _ in range(40):
        assert upload(guest).status_code == 201
    assert upload(guest).status_code == 429


def test_missing_photo_is_404(client):
    assert client.get(f"/api/photos/main/{'0' * 32}").status_code == 404


def test_discard_an_unused_photo(client):
    key = upload(client).json()["photoKey"]
    assert client.delete(f"/api/photos/{key}").status_code == 204
    assert not stored(key)
    assert client.get(f"/api/photos/{key}").status_code == 404


def test_cannot_discard_a_photo_an_item_uses(client):
    key = upload(client).json()["photoKey"]
    client.post("/api/items", json={"name": "Honey", "photoKey": key})
    assert client.delete(f"/api/photos/{key}").status_code == 409
    assert stored(key)


def test_guest_cannot_discard_owner_photos(client, guest):
    key = upload(client).json()["photoKey"]
    assert guest.delete(f"/api/photos/{key}").status_code == 404
    assert stored(key)
