"""A realistic sample pantry for demos when the owner's pantry is still empty.

Items show real product photos (Open Food Facts, CC BY-SA; credits in sample_photos/CREDITS.md).
They live once in S3 under "sample/<name>" and are shared by every sample demo.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from app import db, storage
from app.models import Category, Item, ListEntry, Package

SAMPLE_PHOTOS = "sample/"
PHOTO_DIR = Path(__file__).parent / "sample_photos"

# Item name -> photo file stem in sample_photos/ (<stem>.jpg and <stem>-thumb.jpg).
PHOTOS = {
    "Basmati rice": "basmati-rice",
    "Spaghetti": "spaghetti",
    "Rolled oats": "rolled-oats",
    "Black beans": "black-beans",
    "Diced tomatoes": "diced-tomatoes",
    "Coconut milk": "coconut-milk",
    "Milk": "milk",
    "Eggs": "eggs",
    "Greek yogurt": "greek-yogurt",
    "Butter": "butter",
    "All-purpose flour": "flour",
    "Sugar": "sugar",
    "Olive oil": "olive-oil",
    "Cinnamon": "cinnamon",
    "Peanut butter": "peanut-butter",
    "Granola bars": "granola-bars",
}

# (category, [(name, mode, [(level or count, days until expiry or None), ...]), ...])
SAMPLE = [
    (
        "Grains & pasta",
        [
            ("Basmati rice", "level", [(50, 240), (100, 420)]),
            ("Spaghetti", "count", [(3, 300)]),
            ("Rolled oats", "level", [(25, 150)]),
        ],
    ),
    (
        "Canned goods",
        [
            ("Black beans", "count", [(2, 180), (4, 540)]),
            ("Diced tomatoes", "count", [(1, 270)]),
            ("Coconut milk", "count", [(2, 400)]),
        ],
    ),
    (
        "Dairy & eggs",
        [
            ("Milk", "level", [(50, 5)]),
            ("Eggs", "count", [(6, 12)]),
            ("Greek yogurt", "count", [(1, 2)]),
            ("Butter", "level", [(75, 30)]),
        ],
    ),
    (
        "Baking",
        [
            ("All-purpose flour", "level", [(75, 200)]),
            ("Sugar", "level", [(25, None)]),
        ],
    ),
    (
        "Oils & spices",
        [
            ("Olive oil", "level", [(50, 365)]),
            ("Cinnamon", "level", [(50, None)]),
        ],
    ),
    (
        "Snacks",
        [
            ("Peanut butter", "level", [(25, 120)]),
            ("Granola bars", "count", [(0, 60)]),
        ],
    ),
]

SAMPLE_LIST = ["Birthday candles"]


_photos_ready = False


def _photo_key(name: str) -> str | None:
    stem = PHOTOS.get(name)
    return f"{SAMPLE_PHOTOS}{stem}" if stem and (PHOTO_DIR / f"{stem}.jpg").exists() else None


def ensure_sample_photos() -> None:
    """Upload the shared sample photos the first time they're needed (once per process)."""
    global _photos_ready
    if _photos_ready:
        return
    for stem in PHOTOS.values():
        full, thumb = PHOTO_DIR / f"{stem}.jpg", PHOTO_DIR / f"{stem}-thumb.jpg"
        if not full.exists() or storage.get(f"{SAMPLE_PHOTOS}{stem}-thumb.img") is not None:
            continue
        storage.put(f"{SAMPLE_PHOTOS}{stem}.img", full.read_bytes(), "image/jpeg")
        storage.put(f"{SAMPLE_PHOTOS}{stem}-thumb.img", thumb.read_bytes(), "image/jpeg")
    _photos_ready = True


def seed_sample(space: str) -> None:
    ensure_sample_photos()
    today = date.today()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for order, (category_name, items) in enumerate(SAMPLE):
        category = Category(id=uuid.uuid4().hex, name=category_name, sortOrder=order)
        db.put(space, f"CAT#{category.id}", category.model_dump())
        for name, mode, packages in items:
            item = Item(
                id=uuid.uuid4().hex,
                name=name,
                categoryId=category.id,
                mode=mode,
                packages=[
                    Package(
                        **({"level": amount} if mode == "level" else {"count": amount}),
                        expiresOn=today + timedelta(days=days) if days is not None else None,
                    )
                    for amount, days in packages
                ],
                photoKey=_photo_key(name),
                createdAt=now,
                updatedAt=now,
            )
            db.put(space, f"ITEM#{item.id}", item.model_dump(mode="json"))
    for name in SAMPLE_LIST:
        entry = ListEntry(id=uuid.uuid4().hex, itemId=None, name=name, addedBy="manual", createdAt=now)
        db.put(space, f"LIST#{entry.id}", entry.model_dump())
