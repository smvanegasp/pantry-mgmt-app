import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app import db
from app.models import Item, ItemIn, ItemPatch
from app.routers.categories import get_category
from app.routers.photos import delete_photo
from app.space import current_space
from app.stock import normalize_packages

router = APIRouter(prefix="/api/items", tags=["items"])


def _sk(item_id: str) -> str:
    return f"ITEM#{item_id}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _check_category(space: str, category_id: str | None) -> None:
    if category_id is not None:
        get_category(space, category_id)


def _normalized(item: Item) -> Item:
    return item.model_copy(update={"packages": normalize_packages(item.packages, item.mode)})


def _save(space: str, item: Item) -> None:
    db.put(space, _sk(item.id), item.model_dump(mode="json"))


def _load(space: str, row: dict) -> Item:
    item = Item(**row)
    if "packages" not in row:
        # Persist the upgrade from the pre-packages shape so package ids stay stable.
        _save(space, item)
    return item


def get_item(space: str, item_id: str) -> Item:
    row = db.get(space, _sk(item_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return _load(space, row)


@router.get("")
def list_items(space: str = Depends(current_space)) -> list[Item]:
    items = [_load(space, r) for r in db.query(space, "ITEM#")]
    return sorted(items, key=lambda i: i.name.lower())


@router.post("", status_code=status.HTTP_201_CREATED)
def create_item(body: ItemIn, space: str = Depends(current_space)) -> Item:
    _check_category(space, body.categoryId)
    now = _now()
    item = _normalized(Item(id=uuid.uuid4().hex, createdAt=now, updatedAt=now, **body.model_dump()))
    _save(space, item)
    return item


@router.get("/{item_id}")
def read_item(item_id: str, space: str = Depends(current_space)) -> Item:
    return get_item(space, item_id)


@router.patch("/{item_id}")
def update_item(item_id: str, body: ItemPatch, space: str = Depends(current_space)) -> Item:
    item = get_item(space, item_id)
    changes = body.model_dump(exclude_unset=True)
    # Only optional fields may be cleared; ignore nulls for required ones.
    required = {"name", "mode", "packages"}
    changes = {k: v for k, v in changes.items() if v is not None or k not in required}
    if "categoryId" in changes:
        _check_category(space, changes["categoryId"])
    updated = _normalized(
        Item.model_validate({**item.model_dump(), **changes, "updatedAt": _now()})
    )
    _save(space, updated)
    if updated.photoKey != item.photoKey:
        delete_photo(space, item.photoKey)
    if updated.name != item.name:
        _update_list_entries(space, item_id, name=updated.name)
    return updated


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: str, space: str = Depends(current_space)) -> None:
    item = get_item(space, item_id)
    db.delete(space, _sk(item_id))
    delete_photo(space, item.photoKey)
    # Keep it on the grocery list as a plain entry; the user may still want to buy it.
    _update_list_entries(space, item_id, itemId=None)


def _update_list_entries(space: str, item_id: str, **changes: object) -> None:
    for row in db.query(space, "LIST#"):
        if row.get("itemId") == item_id:
            db.put(space, f"LIST#{row['id']}", {**row, **changes})
