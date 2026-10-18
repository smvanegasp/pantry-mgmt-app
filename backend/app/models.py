from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
# Fill level presets: Empty, 1/4, 1/2, 3/4, Full.
Level = Literal[0, 25, 50, 75, 100]
Mode = Literal["level", "count"]
Count = Annotated[int, Field(ge=0, le=999)]


class CategoryIn(BaseModel):
    name: Name


class CategoryPatch(BaseModel):
    name: Name | None = None
    sortOrder: int | None = None


class Category(BaseModel):
    id: str
    name: str
    sortOrder: int


class ItemIn(BaseModel):
    name: Name
    categoryId: str | None = None
    mode: Mode = "level"
    level: Level = 100
    count: Count = 1
    # None means "use the pantry-wide default".
    buyWhenLevel: Level | None = None
    buyWhenCount: Count | None = None
    expiresOn: date | None = None


class ItemPatch(BaseModel):
    """Partial update; send a field as null to clear it."""

    name: Name | None = None
    categoryId: str | None = None
    mode: Mode | None = None
    level: Level | None = None
    count: Count | None = None
    buyWhenLevel: Level | None = None
    buyWhenCount: Count | None = None
    expiresOn: date | None = None


class Item(ItemIn):
    id: str
    createdAt: str
    updatedAt: str


class Settings(BaseModel):
    """Pantry-wide defaults; items can override them individually."""

    buyWhenLevel: Level = 25
    buyWhenCount: Count = 1


class ListEntryIn(BaseModel):
    """Add a pantry item (by id) or a free-text entry (by name) to the grocery list."""

    itemId: str | None = None
    name: Name | None = None


class ListEntryPatch(BaseModel):
    checked: bool | None = None
    name: Name | None = None


class ListEntry(BaseModel):
    id: str
    itemId: str | None
    name: str
    checked: bool = False
    addedBy: Literal["auto", "manual"]
    createdAt: str
