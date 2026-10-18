def add_item(client, **body):
    return client.post("/api/items", json=body).json()


def names(entries):
    return [e["name"] for e in entries]


def test_settings_default_and_update(client):
    assert client.get("/api/settings").json() == {"buyWhenLevel": 25, "buyWhenCount": 1}
    updated = client.put("/api/settings", json={"buyWhenLevel": 50, "buyWhenCount": 2}).json()
    assert updated == {"buyWhenLevel": 50, "buyWhenCount": 2}
    assert client.get("/api/settings").json() == updated
    assert client.put("/api/settings", json={"buyWhenLevel": 30}).status_code == 422


def test_generate_adds_low_items_only(client):
    add_item(client, name="Rice", level=25)
    add_item(client, name="Oil", level=50)
    add_item(client, name="Salt", level=0)
    add_item(client, name="Eggs", mode="count", count=1)
    add_item(client, name="Cans", mode="count", count=5)

    result = client.post("/api/list/generate").json()

    assert sorted(names(result["added"])) == ["Eggs", "Rice", "Salt"]
    assert all(e["addedBy"] == "auto" and not e["checked"] for e in result["added"])
    assert sorted(names(client.get("/api/list").json())) == ["Eggs", "Rice", "Salt"]


def test_generate_respects_item_overrides(client):
    add_item(client, name="Coffee", level=50, buyWhenLevel=50)
    add_item(client, name="Flour", level=25, buyWhenLevel=0)
    add_item(client, name="Milk", mode="count", count=2, buyWhenCount=2)

    added = client.post("/api/list/generate").json()["added"]

    assert sorted(names(added)) == ["Coffee", "Milk"]


def test_generate_uses_pantry_settings(client):
    add_item(client, name="Oil", level=50)
    client.put("/api/settings", json={"buyWhenLevel": 50, "buyWhenCount": 1})
    assert names(client.post("/api/list/generate").json()["added"]) == ["Oil"]


def test_generate_does_not_duplicate(client):
    add_item(client, name="Rice", level=0)
    client.post("/api/list/generate")

    second = client.post("/api/list/generate").json()

    assert second["added"] == []
    assert names(second["list"]) == ["Rice"]


def test_manual_add_item_and_free_text(client):
    rice = add_item(client, name="Rice")

    linked = client.post("/api/list", json={"itemId": rice["id"]})
    free = client.post("/api/list", json={"name": "  Birthday candles "})

    assert linked.status_code == 201
    assert linked.json()["itemId"] == rice["id"]
    assert linked.json()["addedBy"] == "manual"
    assert free.json()["name"] == "Birthday candles"
    assert free.json()["itemId"] is None
    assert names(client.get("/api/list").json()) == ["Rice", "Birthday candles"]


def test_manual_add_existing_item_is_idempotent(client):
    rice = add_item(client, name="Rice")
    first = client.post("/api/list", json={"itemId": rice["id"]}).json()
    again = client.post("/api/list", json={"itemId": rice["id"]})
    assert again.status_code == 200
    assert again.json()["id"] == first["id"]
    assert len(client.get("/api/list").json()) == 1


def test_manual_add_validation(client):
    assert client.post("/api/list", json={}).status_code == 422
    assert client.post("/api/list", json={"itemId": "nope"}).status_code == 404


def test_check_and_uncheck(client):
    entry = client.post("/api/list", json={"name": "Bread"}).json()
    checked = client.patch(f"/api/list/{entry['id']}", json={"checked": True}).json()
    assert checked["checked"] is True
    assert checked["name"] == "Bread"
    unchecked = client.patch(f"/api/list/{entry['id']}", json={"checked": False}).json()
    assert unchecked["checked"] is False


def test_delete_entry(client):
    entry = client.post("/api/list", json={"name": "Bread"}).json()
    assert client.delete(f"/api/list/{entry['id']}").status_code == 204
    assert client.get("/api/list").json() == []
    assert client.delete(f"/api/list/{entry['id']}").status_code == 404


def test_renaming_item_renames_its_list_entry(client):
    rice = add_item(client, name="Rice")
    client.post("/api/list", json={"itemId": rice["id"]})
    client.patch(f"/api/items/{rice['id']}", json={"name": "Basmati rice"})
    assert names(client.get("/api/list").json()) == ["Basmati rice"]


def test_deleting_item_keeps_it_on_list_as_free_text(client):
    rice = add_item(client, name="Rice")
    client.post("/api/list", json={"itemId": rice["id"]})
    client.delete(f"/api/items/{rice['id']}")
    [entry] = client.get("/api/list").json()
    assert entry["name"] == "Rice"
    assert entry["itemId"] is None
