import uuid
from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints, model_validator

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


class Package(BaseModel):
    """One physical container of a product: a bag, a bottle, a batch of cans.

    Only `level` or `count` is used, depending on the item's mode.
    """

    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    level: Level = 100
    count: Count = 1
    expiresOn: date | None = None


Packages = Annotated[list[Package], Field(min_length=1, max_length=20)]
# "<space>/<photo id>" as returned by POST /api/photos.
PhotoKey = Annotated[str, StringConstraints(pattern=r"^(main|sb-\d+-[0-9a-f]{32})/[0-9a-f]{32}$")]


class ItemIn(BaseModel):
    name: Name
    categoryId: str | None = None
    mode: Mode = "level"
    # None means "use the pantry-wide default".
    buyWhenLevel: Level | None = None
    buyWhenCount: Count | None = None
    packages: Packages = Field(default_factory=lambda: [Package()])
    photoKey: PhotoKey | None = None


class ItemPatch(BaseModel):
    """Partial update; send a field as null to clear it. `packages` replaces the whole list."""

    name: Name | None = None
    categoryId: str | None = None
    mode: Mode | None = None
    buyWhenLevel: Level | None = None
    buyWhenCount: Count | None = None
    packages: Packages | None = None
    photoKey: PhotoKey | None = None


class Item(ItemIn):
    id: str
    createdAt: str
    updatedAt: str

    @model_validator(mode="before")
    @classmethod
    def _upgrade_single_package_rows(cls, data: Any) -> Any:
        """Rows saved before packages existed kept level/count/expiresOn on the item."""
        if isinstance(data, dict) and "packages" not in data:
            data = dict(data)
            data["packages"] = [
                {
                    "level": data.pop("level", 100),
                    "count": data.pop("count", 1),
                    "expiresOn": data.pop("expiresOn", None),
                }
            ]
        return data


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


class NewItemFields(BaseModel):
    """What's needed to create a pantry item from a free-text list entry."""

    name: Name
    categoryId: str | None = None
    mode: Mode = "level"


class RestockIn(BaseModel):
    """Put a bought list entry away.

    "How full" items get `quantity` new full packages; "how many" items get one new
    package holding `quantity`. Free-text entries need `newItem` to become pantry items.
    """

    quantity: Annotated[int, Field(ge=1, le=99)] = 1
    expiresOn: date | None = None
    newItem: NewItemFields | None = None


class ListEntry(BaseModel):
    id: str
    itemId: str | None
    name: str
    checked: bool = False
    addedBy: Literal["auto", "manual"]
    createdAt: str
