def test_create_and_list_categories_in_order(client):
    for name in ["Dairy", "Snacks", "Spices"]:
        assert client.post("/api/categories", json={"name": name}).status_code == 201

    names = [c["name"] for c in client.get("/api/categories").json()]
    assert names == ["Dairy", "Snacks", "Spices"]


def test_duplicate_category_name_is_rejected(client):
    client.post("/api/categories", json={"name": "Dairy"})
    assert client.post("/api/categories", json={"name": " dairy "}).status_code == 409


def test_blank_category_name_is_rejected(client):
    assert client.post("/api/categories", json={"name": "   "}).status_code == 422


def test_rename_category(client):
    cat = client.post("/api/categories", json={"name": "Diary"}).json()
    response = client.patch(f"/api/categories/{cat['id']}", json={"name": "Dairy"})
    assert response.json()["name"] == "Dairy"


def test_deleting_category_uncategorizes_its_items(client):
    cat = client.post("/api/categories", json={"name": "Dairy"}).json()
    item = client.post("/api/items", json={"name": "Milk", "categoryId": cat["id"]}).json()

    assert client.delete(f"/api/categories/{cat['id']}").status_code == 204

    assert client.get("/api/categories").json() == []
    assert client.get(f"/api/items/{item['id']}").json()["categoryId"] is None


def test_unknown_category_is_404(client):
    assert client.patch("/api/categories/nope", json={"name": "X"}).status_code == 404
    assert client.delete("/api/categories/nope").status_code == 404
