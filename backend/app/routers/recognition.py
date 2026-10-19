from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app import ratelimit, storage
from app.models import PhotoKey
from app.recognize import RecognitionFailed, RecognitionUnavailable, recognize
from app.routers.categories import list_categories
from app.routers.photos import can_read, object_keys
from app.sandbox import PREFIX
from app.space import current_space

router = APIRouter(prefix="/api/recognize", tags=["recognition"])

# Each call costs a fraction of a cent; these keep the monthly bill small no matter what.
GUEST_PER_DAY = 20
OWNER_PER_DAY = 300
ALL_PER_DAY = 1000


class RecognizeIn(BaseModel):
    photoKey: PhotoKey


class Suggestion(BaseModel):
    """What the photo looks like; the user reviews it before anything is saved."""

    isProduct: bool
    name: str
    categoryId: str | None
    # Set when the model suggests a category that doesn't exist yet.
    newCategoryName: str | None
    mode: Literal["level", "count"]
    count: int | None
    expiresOn: date | None


def _check_limits(space: str) -> None:
    per_space = GUEST_PER_DAY if space.startswith(PREFIX) else OWNER_PER_DAY
    if ratelimit.hit(f"recognize#{space}", 86400) > per_space:
        raise ratelimit.too_many("That's the photo reading limit for today; fill it in by hand for now")
    if ratelimit.hit("recognize-all", 86400) > ALL_PER_DAY:
        raise ratelimit.too_many("Photo reading is busy today; fill it in by hand for now")


@router.post("")
def recognize_photo(body: RecognizeIn, space: str = Depends(current_space)) -> Suggestion:
    if not can_read(space, body.photoKey):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    found = storage.get(object_keys(body.photoKey)[0])
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    _check_limits(space)

    categories = list_categories(space)
    image, mime_type = found
    try:
        answer = recognize(image, mime_type, [c.name for c in categories], date.today())
    except RecognitionUnavailable:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Photo reading isn't set up") from None
    except RecognitionFailed:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't read the photo; try again") from None

    by_name = {c.name.strip().lower(): c.id for c in categories}
    suggested = (answer.categoryName or "").strip()
    category_id = by_name.get(suggested.lower())
    return Suggestion(
        isProduct=answer.isProduct,
        name=(answer.name or "").strip()[:80],
        categoryId=category_id,
        newCategoryName=suggested[:80] if suggested and category_id is None else None,
        mode=answer.mode,
        count=max(1, min(answer.count, 999)) if answer.mode == "count" and answer.count else None,
        expiresOn=answer.expiresOn,
    )
