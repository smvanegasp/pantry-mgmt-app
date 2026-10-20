"""The sample pantry's shared product photos (app/sample_photos, S3 "sample/...")."""

from app.sample_data import PHOTO_DIR, PHOTOS


def sample_demo(client):
    assert client.post("/api/session/guest/reset?sample=true").status_code == 200
    return {i["name"]: i for i in client.get("/api/items").json()}


def test_every_sample_item_has_a_photo_file():
    for stem in PHOTOS.values():
        assert (PHOTO_DIR / f"{stem}.jpg").exists(), stem
        assert (PHOTO_DIR / f"{stem}-thumb.jpg").exists(), stem


def test_sample_items_show_shared_photos(anon):
    items = sample_demo(anon)
    assert items["Olive oil"]["photoKey"] == "sample/olive-oil"
    assert all(i["photoKey"] == f"sample/{PHOTOS[name]}" for name, i in items.items())
    for size in ("full", "thumb"):
        photo = anon.get(f"/api/photos/sample/olive-oil?size={size}")
        assert photo.status_code == 200
        assert photo.headers["content-type"] == "image/jpeg"
        assert photo.content.startswith(b"\xff\xd8\xff")


def test_shared_photos_survive_deleting_the_item(anon):
    items = sample_demo(anon)
    assert anon.delete(f"/api/items/{items['Olive oil']['id']}").status_code == 204
    assert anon.delete("/api/photos/sample/olive-oil").status_code == 404
    # Another demo (and this one) still sees it.
    assert anon.get("/api/photos/sample/olive-oil").status_code == 200


def test_items_can_point_at_sample_photos_but_not_made_up_keys(anon):
    sample_demo(anon)
    ok = anon.post("/api/items", json={"name": "More oil", "photoKey": "sample/olive-oil"})
    assert ok.status_code == 201
    bad = anon.post("/api/items", json={"name": "Nope", "photoKey": "sample/../main/x"})
    assert bad.status_code == 422
