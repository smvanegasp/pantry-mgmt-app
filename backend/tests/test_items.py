from app import db


def levels(item):
    return [p["level"] for p in item["packages"]]


def counts(item):
    return [p["count"] for p in item["packages"]]


def test_create_item_with_defaults(client):
    response = client.post("/api/items", json={"name": "  Rice  "})
    assert response.status_code == 201
    item = response.json()
    assert item["name"] == "Rice"
    assert item["mode"] == "level"
    assert item["buyWhenLevel"] is None
    assert item["categoryId"] is None
    [package] = item["packages"]
    assert package["level"] == 100
    assert package["count"] == 1
    assert package["expiresOn"] is None
    assert package["id"]


def test_create_full_item_and_read_it_back(client):
    cat = client.post("/api/categories", json={"name": "Canned"}).json()
    body = {
        "name": "Black beans",
        "categoryId": cat["id"],
        "mode": "count",
        "buyWhenCount": 1,
        "packages": [
            {"count": 2, "expiresOn": "2026-11-01"},
            {"count": 4, "expiresOn": "2027-03-31"},
        ],
    }
    created = client.post("/api/items", json=body).json()

    fetched = client.get(f"/api/items/{created['id']}").json()
    assert fetched == created
    assert counts(fetched) == [2, 4]
    assert [p["expiresOn"] for p in fetched["packages"]] == ["2026-11-01", "2027-03-31"]


def test_list_items_sorted_by_name(client):
    for name in ["rice", "Apples", "beans"]:
        client.post("/api/items", json={"name": name})
    assert [i["name"] for i in client.get("/api/items").json()] == ["Apples", "beans", "rice"]


def test_only_preset_levels_are_allowed(client):
    bad = {"name": "Oil", "packages": [{"level": 30}]}
    good = {"name": "Oil", "packages": [{"level": 75}]}
    assert client.post("/api/items", json=bad).status_code == 422
    assert client.post("/api/items", json=good).status_code == 201


def test_count_cannot_be_negative(client):
    body = {"name": "Eggs", "mode": "count", "packages": [{"count": -1}]}
    assert client.post("/api/items", json=body).status_code == 422


def test_an_item_needs_at_least_one_package(client):
    assert client.post("/api/items", json={"name": "Salt", "packages": []}).status_code == 422


def test_unknown_category_is_rejected(client):
    assert client.post("/api/items", json={"name": "Milk", "categoryId": "nope"}).status_code == 404


def test_finished_packages_are_dropped_while_others_remain(client):
    body = {"name": "Rice", "packages": [{"level": 0}, {"level": 100}]}
    item = client.post("/api/items", json=body).json()
    assert levels(item) == [100]

    updated = client.patch(f"/api/items/{item['id']}", json={"packages": [{"level": 0}]}).json()
    # The last package stays (now empty) so the item still exists.
    assert levels(updated) == [0]


def test_finished_count_packages_are_dropped(client):
    body = {"name": "Beans", "mode": "count", "packages": [{"count": 0}, {"count": 3}]}
    assert counts(client.post("/api/items", json=body).json()) == [3]


def test_patch_packages_keeps_other_fields(client):
    item = client.post("/api/items", json={"name": "Flour", "buyWhenLevel": 50}).json()
    package = {**item["packages"][0], "level": 25}

    updated = client.patch(f"/api/items/{item['id']}", json={"packages": [package]}).json()

    assert levels(updated) == [25]
    assert updated["packages"][0]["id"] == package["id"]
    assert updated["buyWhenLevel"] == 50
    assert updated["name"] == "Flour"
    assert updated["createdAt"] == item["createdAt"]


def test_add_a_second_package(client):
    item = client.post("/api/items", json={"name": "Rice", "packages": [{"level": 50}]}).json()
    packages = item["packages"] + [{"level": 100, "expiresOn": "2027-06-01"}]

    updated = client.patch(f"/api/items/{item['id']}", json={"packages": packages}).json()

    assert levels(updated) == [50, 100]
    assert updated["packages"][1]["expiresOn"] == "2027-06-01"


def test_patch_null_clears_optional_fields_only(client):
    item = client.post("/api/items", json={"name": "Yogurt", "buyWhenLevel": 50}).json()

    updated = client.patch(
        f"/api/items/{item['id']}",
        json={"buyWhenLevel": None, "name": None, "packages": None},
    ).json()

    assert updated["buyWhenLevel"] is None
    assert updated["name"] == "Yogurt"
    assert len(updated["packages"]) == 1


def test_switch_mode_to_count(client):
    item = client.post("/api/items", json={"name": "Cans"}).json()
    updated = client.patch(
        f"/api/items/{item['id']}", json={"mode": "count", "packages": [{"count": 4}]}
    ).json()
    assert updated["mode"] == "count"
    assert counts(updated) == [4]


def test_rows_saved_before_packages_are_upgraded(client):
    # The shape stage 1 wrote to the database.
    db.put(
        "main",
        "ITEM#legacy",
        {
            "id": "legacy",
            "name": "Old rice",
            "categoryId": None,
            "mode": "level",
            "level": 50,
            "count": 1,
            "buyWhenLevel": None,
            "buyWhenCount": None,
            "expiresOn": "2027-01-01",
            "createdAt": "2026-10-18T00:00:00+00:00",
            "updatedAt": "2026-10-18T00:00:00+00:00",
        },
    )

    item = client.get("/api/items/legacy").json()

    assert levels(item) == [50]
    assert item["packages"][0]["expiresOn"] == "2027-01-01"
    assert "level" not in item and "expiresOn" not in item
    # The upgrade is saved on first read, so the package id is stable.
    assert "packages" in db.get("main", "ITEM#legacy")
    assert client.get("/api/items").json()[0]["packages"] == item["packages"]


def test_delete_item(client):
    item = client.post("/api/items", json={"name": "Salt"}).json()
    assert client.delete(f"/api/items/{item['id']}").status_code == 204
    assert client.get(f"/api/items/{item['id']}").status_code == 404
    assert client.delete(f"/api/items/{item['id']}").status_code == 404
