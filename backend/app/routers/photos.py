import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel

from app import db, ratelimit, storage
from app.sample_data import SAMPLE_PHOTOS
from app.sandbox import OWNER_SPACE, PREFIX
from app.space import current_space

router = APIRouter(prefix="/api/photos", tags=["photos"])

# The phone resizes photos before upload, so real uploads are far below these limits.
MAX_PHOTO_BYTES = 3 * 1024 * 1024
MAX_THUMB_BYTES = 400 * 1024
GUEST_PHOTOS_PER_DAY = 40
# Magic numbers of the formats a browser canvas can produce.
SIGNATURES = {b"\xff\xd8\xff": "image/jpeg", b"\x89PNG": "image/png", b"RIFF": "image/webp"}


class PhotoOut(BaseModel):
    photoKey: str


def _detect_type(data: bytes) -> str | None:
    for magic, content_type in SIGNATURES.items():
        if data.startswith(magic) and (content_type != "image/webp" or data[8:12] == b"WEBP"):
            return content_type
    return None


async def _read_image(upload: UploadFile, limit: int, label: str) -> tuple[bytes, str]:
    data = await upload.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"The {label} is too large")
    content_type = _detect_type(data)
    if content_type is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"The {label} must be an image")
    return data, content_type


def object_keys(photo_key: str) -> tuple[str, str]:
    return f"{photo_key}.img", f"{photo_key}-thumb.img"


def owns(space: str, photo_key: str) -> bool:
    """Only photos uploaded in this space may be replaced or deleted from it."""
    return photo_key.startswith(f"{space}/")


def can_read(space: str, photo_key: str) -> bool:
    # Demos are copies of the owner's pantry, so they show the owner's photos too; the sample
    # pantry's photos are shared by everyone (and owned by no space, so never deleted).
    return (
        owns(space, photo_key)
        or photo_key.startswith(f"{OWNER_SPACE}/")
        or photo_key.startswith(SAMPLE_PHOTOS)
    )


def delete_photo(space: str, photo_key: str | None) -> None:
    if photo_key and owns(space, photo_key):
        storage.delete(*object_keys(photo_key))


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_photo(
    photo: UploadFile = File(...),
    thumb: UploadFile = File(...),
    space: str = Depends(current_space),
) -> PhotoOut:
    if space.startswith(PREFIX) and ratelimit.hit(f"photos#{space}", 86400) > GUEST_PHOTOS_PER_DAY:
        raise ratelimit.too_many("That's a lot of photos for one demo; try again tomorrow")
    full_data, full_type = await _read_image(photo, MAX_PHOTO_BYTES, "photo")
    thumb_data, thumb_type = await _read_image(thumb, MAX_THUMB_BYTES, "thumbnail")
    photo_key = f"{space}/{uuid.uuid4().hex}"
    full_key, thumb_key = object_keys(photo_key)
    storage.put(full_key, full_data, full_type)
    storage.put(thumb_key, thumb_data, thumb_type)
    return PhotoOut(photoKey=photo_key)


@router.get("/{owner}/{photo_id}")
def read_photo(
    owner: str,
    photo_id: str,
    size: Literal["full", "thumb"] = "full",
    space: str = Depends(current_space),
) -> Response:
    photo_key = f"{owner}/{photo_id}"
    if not can_read(space, photo_key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    full_key, thumb_key = object_keys(photo_key)
    found = storage.get(thumb_key if size == "thumb" else full_key)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    data, content_type = found
    # Keys are never reused, so browsers may cache them forever (privately, per user).
    return Response(
        data,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )


@router.delete("/{owner}/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_photo(owner: str, photo_id: str, space: str = Depends(current_space)) -> None:
    """Throw away an uploaded photo that was never used (e.g. a bad shot while stocking up).

    Only photos uploaded in this space, and not attached to any item, can be deleted.
    """
    photo_key = f"{owner}/{photo_id}"
    if not owns(space, photo_key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo not found")
    if any(row.get("photoKey") == photo_key for row in db.query(space, "ITEM#")):
        raise HTTPException(status.HTTP_409_CONFLICT, "That photo belongs to an item")
    delete_photo(space, photo_key)
