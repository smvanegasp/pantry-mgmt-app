def add_item(client, **body):
    return client.post("/api/items", json=body).json()


def put_on_list(client, **body):
    return client.post("/api/list", json=body).json()


def restock(client, entry, **body):
    return client.post(f"/api/list/{entry['id']}/restock", json=body)


def test_restock_level_item_adds_a_full_package(client):
    rice = add_item(client, name="Rice", packages=[{"level": 25}])
    entry = put_on_list(client, itemId=rice["id"])

    response = restock(client, entry, expiresOn="2027-06-01")

    assert response.status_code == 200
    packages = response.json()["packages"]
    assert [(p["level"], p["expiresOn"]) for p in packages] == [(25, None), (100, "2027-06-01")]
    assert client.get("/api/list").json() == []


def test_restock_replaces_an_empty_package(client):
    oil = add_item(client, name="Oil", packages=[{"level": 0}])
    entry = put_on_list(client, itemId=oil["id"])

    packages = restock(client, entry).json()["packages"]

    assert [p["level"] for p in packages] == [100]


def test_restock_several_level_packages(client):
    coffee = add_item(client, name="Coffee", packages=[{"level": 0}])
    entry = put_on_list(client, itemId=coffee["id"])

    packages = restock(client, entry, quantity=3).json()["packages"]

    assert [p["level"] for p in packages] == [100, 100, 100]


def test_restock_count_item_adds_one_batch(client):
    beans = add_item(
        client, name="Beans", mode="count", packages=[{"count": 1, "expiresOn": "2026-11-01"}]
    )
    entry = put_on_list(client, itemId=beans["id"])

    packages = restock(client, entry, quantity=6, expiresOn="2027-10-01").json()["packages"]

    assert [(p["count"], p["expiresOn"]) for p in packages] == [
        (1, "2026-11-01"),
        (6, "2027-10-01"),
    ]


def test_restock_free_text_entry_creates_item(client):
    cat = client.post("/api/categories", json={"name": "Baking"}).json()
    entry = put_on_list(client, name="Yeast")

    response = restock(
        client,
        entry,
        quantity=2,
        newItem={"name": "Dry yeast", "categoryId": cat["id"], "mode": "count"},
    )

    item = response.json()
    assert item["name"] == "Dry yeast"
    assert item["categoryId"] == cat["id"]
    assert [p["count"] for p in item["packages"]] == [2]
    assert [i["name"] for i in client.get("/api/items").json()] == ["Dry yeast"]
    assert client.get("/api/list").json() == []


def test_restock_free_text_without_new_item_is_rejected(client):
    entry = put_on_list(client, name="Candles")
    assert restock(client, entry).status_code == 422
    assert len(client.get("/api/list").json()) == 1


def test_restock_with_unknown_category_keeps_entry(client):
    entry = put_on_list(client, name="Yeast")
    response = restock(client, entry, newItem={"name": "Yeast", "categoryId": "nope"})
    assert response.status_code == 404
    assert len(client.get("/api/list").json()) == 1


def test_restock_respects_package_limit(client):
    rice = add_item(client, name="Rice", packages=[{"level": 100}] * 19)
    entry = put_on_list(client, itemId=rice["id"])

    assert restock(client, entry, quantity=2).status_code == 422
    assert restock(client, entry, quantity=1).status_code == 200


def test_restock_quantity_bounds(client):
    rice = add_item(client, name="Rice")
    entry = put_on_list(client, itemId=rice["id"])
    assert restock(client, entry, quantity=0).status_code == 422
    assert restock(client, entry, quantity=100).status_code == 422


def test_restock_unknown_entry_is_404(client):
    assert client.post("/api/list/nope/restock", json={}).status_code == 404
