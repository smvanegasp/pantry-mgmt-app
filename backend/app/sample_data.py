"""A realistic sample pantry for demos when the owner's pantry is still empty."""

import uuid
from datetime import date, datetime, timedelta, timezone

from app import db
from app.models import Category, Item, ListEntry, Package

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


def seed_sample(space: str) -> None:
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
                createdAt=now,
                updatedAt=now,
            )
            db.put(space, f"ITEM#{item.id}", item.model_dump(mode="json"))
    for name in SAMPLE_LIST:
        entry = ListEntry(id=uuid.uuid4().hex, itemId=None, name=name, addedBy="manual", createdAt=now)
        db.put(space, f"LIST#{entry.id}", entry.model_dump())
