import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel

from app import db
from app.models import (
    Item,
    ItemIn,
    ItemPatch,
    ListEntry,
    ListEntryIn,
    ListEntryPatch,
    Mode,
    Package,
    RestockIn,
)
from app.routers.items import create_item, get_item, list_items, update_item
from app.routers.settings import get_settings
from app.space import current_space
from app.stock import is_low, normalize_packages

router = APIRouter(prefix="/api/list", tags=["grocery list"])


def _sk(entry_id: str) -> str:
    return f"LIST#{entry_id}"


def _now() -> str:
    # Microseconds keep entries added in one batch in a stable order.
    return datetime.now(timezone.utc).isoformat()


def _save(space: str, entry: ListEntry) -> None:
    db.put(space, _sk(entry.id), entry.model_dump())


def _new_entry(item_id: str | None, name: str, added_by: str) -> ListEntry:
    return ListEntry(
        id=uuid.uuid4().hex, itemId=item_id, name=name, addedBy=added_by, createdAt=_now()
    )


def get_entry(space: str, entry_id: str) -> ListEntry:
    row = db.get(space, _sk(entry_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "List entry not found")
    return ListEntry(**row)


def list_entries(space: str) -> list[ListEntry]:
    entries = [ListEntry(**r) for r in db.query(space, "LIST#")]
    return sorted(entries, key=lambda e: e.createdAt)


@router.get("")
def read_list(space: str = Depends(current_space)) -> list[ListEntry]:
    return list_entries(space)


@router.post("", status_code=status.HTTP_201_CREATED)
def add_entry(body: ListEntryIn, response: Response, space: str = Depends(current_space)) -> ListEntry:
    if body.itemId is not None:
        item = get_item(space, body.itemId)
        # Adding an item that's already on the list is a no-op.
        existing = next((e for e in list_entries(space) if e.itemId == item.id), None)
        if existing:
            response.status_code = status.HTTP_200_OK
            return existing
        entry = _new_entry(item.id, item.name, "manual")
    elif body.name is not None:
        entry = _new_entry(None, body.name, "manual")
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Provide an itemId or a name")
    _save(space, entry)
    return entry


class GenerateResult(BaseModel):
    added: list[ListEntry]
    list: list[ListEntry]


@router.post("/generate")
def generate(space: str = Depends(current_space)) -> GenerateResult:
    """Add every low pantry item that isn't on the list yet."""
    settings = get_settings(space)
    entries = list_entries(space)
    on_list = {e.itemId for e in entries if e.itemId}
    added = []
    for item in list_items(space):
        if item.id not in on_list and is_low(item, settings):
            entry = _new_entry(item.id, item.name, "auto")
            _save(space, entry)
            added.append(entry)
    return GenerateResult(added=added, list=entries + added)


MAX_PACKAGES = 20


def _with_bought(packages: list[Package], body: RestockIn, mode: Mode) -> list[Package]:
    """Existing packages plus what was bought, with finished packages dropped."""
    if mode == "count":
        bought = [Package(count=body.quantity, expiresOn=body.expiresOn)]
    else:
        bought = [Package(level=100, expiresOn=body.expiresOn) for _ in range(body.quantity)]
    combined = normalize_packages(packages + bought, mode)
    if len(combined) > MAX_PACKAGES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"An item can hold at most {MAX_PACKAGES} packages",
        )
    return combined


@router.post("/{entry_id}/restock")
def restock(entry_id: str, body: RestockIn, space: str = Depends(current_space)) -> Item:
    """Add what was bought to the pantry and take the entry off the list."""
    entry = get_entry(space, entry_id)
    if entry.itemId is not None:
        item = get_item(space, entry.itemId)
        packages = _with_bought(item.packages, body, item.mode)
        restocked = update_item(item.id, ItemPatch(packages=packages), space)
    elif body.newItem is not None:
        fields = body.newItem
        packages = _with_bought([], body, fields.mode)
        restocked = create_item(ItemIn(**fields.model_dump(), packages=packages), space)
    else:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "This entry isn't a pantry item yet; send newItem to add it",
        )
    db.delete(space, _sk(entry_id))
    return restocked


@router.patch("/{entry_id}")
def update_entry(
    entry_id: str, body: ListEntryPatch, space: str = Depends(current_space)
) -> ListEntry:
    entry = get_entry(space, entry_id)
    updated = entry.model_copy(update=body.model_dump(exclude_none=True))
    _save(space, updated)
    return updated


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: str, space: str = Depends(current_space)) -> None:
    get_entry(space, entry_id)
    db.delete(space, _sk(entry_id))
