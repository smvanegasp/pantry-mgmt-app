import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app import db
from app.models import Category, CategoryIn, CategoryPatch
from app.space import current_space

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _sk(category_id: str) -> str:
    return f"CAT#{category_id}"


def get_category(space: str, category_id: str) -> Category:
    row = db.get(space, _sk(category_id))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    return Category(**row)


@router.get("")
def list_categories(space: str = Depends(current_space)) -> list[Category]:
    rows = [Category(**r) for r in db.query(space, "CAT#")]
    return sorted(rows, key=lambda c: (c.sortOrder, c.name.lower()))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryIn, space: str = Depends(current_space)) -> Category:
    existing = list_categories(space)
    if any(c.name.lower() == body.name.lower() for c in existing):
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with that name already exists")
    category = Category(id=uuid.uuid4().hex, name=body.name, sortOrder=len(existing))
    db.put(space, _sk(category.id), category.model_dump())
    return category


@router.patch("/{category_id}")
def update_category(
    category_id: str, body: CategoryPatch, space: str = Depends(current_space)
) -> Category:
    category = get_category(space, category_id)
    updated = category.model_copy(update=body.model_dump(exclude_none=True))
    db.put(space, _sk(category_id), updated.model_dump())
    return updated


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: str, space: str = Depends(current_space)) -> None:
    get_category(space, category_id)
    # Items in a deleted category become uncategorized rather than disappearing.
    for row in db.query(space, "ITEM#"):
        if row.get("categoryId") == category_id:
            row["categoryId"] = None
            db.put(space, f"ITEM#{row['id']}", row)
    db.delete(space, _sk(category_id))
