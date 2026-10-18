def test_create_item_with_defaults(client):
    response = client.post("/api/items", json={"name": "  Rice  "})
    assert response.status_code == 201
    item = response.json()
    assert item["name"] == "Rice"
    assert item["mode"] == "level"
    assert item["level"] == 100
    assert item["count"] == 1
    assert item["buyWhenLevel"] is None
    assert item["expiresOn"] is None
    assert item["categoryId"] is None


def test_create_full_item_and_read_it_back(client):
    cat = client.post("/api/categories", json={"name": "Canned"}).json()
    body = {
        "name": "Black beans",
        "categoryId": cat["id"],
        "mode": "count",
        "count": 3,
        "buyWhenCount": 1,
        "expiresOn": "2027-03-31",
    }
    created = client.post("/api/items", json=body).json()

    fetched = client.get(f"/api/items/{created['id']}").json()
    assert fetched == created
    assert fetched["count"] == 3
    assert fetched["expiresOn"] == "2027-03-31"


def test_list_items_sorted_by_name(client):
    for name in ["rice", "Apples", "beans"]:
        client.post("/api/items", json={"name": name})
    assert [i["name"] for i in client.get("/api/items").json()] == ["Apples", "beans", "rice"]


def test_only_preset_levels_are_allowed(client):
    assert client.post("/api/items", json={"name": "Oil", "level": 30}).status_code == 422
    assert client.post("/api/items", json={"name": "Oil", "level": 75}).status_code == 201


def test_count_cannot_be_negative(client):
    assert client.post("/api/items", json={"name": "Eggs", "count": -1}).status_code == 422


def test_unknown_category_is_rejected(client):
    assert client.post("/api/items", json={"name": "Milk", "categoryId": "nope"}).status_code == 404


def test_patch_updates_level_and_keeps_other_fields(client):
    item = client.post("/api/items", json={"name": "Flour", "expiresOn": "2027-01-01"}).json()

    updated = client.patch(f"/api/items/{item['id']}", json={"level": 25}).json()

    assert updated["level"] == 25
    assert updated["expiresOn"] == "2027-01-01"
    assert updated["name"] == "Flour"
    assert updated["createdAt"] == item["createdAt"]


def test_patch_null_clears_optional_fields_only(client):
    item = client.post(
        "/api/items", json={"name": "Yogurt", "expiresOn": "2027-01-01", "buyWhenLevel": 50}
    ).json()

    updated = client.patch(
        f"/api/items/{item['id']}",
        json={"expiresOn": None, "buyWhenLevel": None, "name": None},
    ).json()

    assert updated["expiresOn"] is None
    assert updated["buyWhenLevel"] is None
    assert updated["name"] == "Yogurt"


def test_switch_mode_to_count(client):
    item = client.post("/api/items", json={"name": "Cans"}).json()
    updated = client.patch(f"/api/items/{item['id']}", json={"mode": "count", "count": 4}).json()
    assert updated["mode"] == "count"
    assert updated["count"] == 4


def test_delete_item(client):
    item = client.post("/api/items", json={"name": "Salt"}).json()
    assert client.delete(f"/api/items/{item['id']}").status_code == 204
    assert client.get(f"/api/items/{item['id']}").status_code == 404
    assert client.delete(f"/api/items/{item['id']}").status_code == 404
