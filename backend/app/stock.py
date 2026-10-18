from app.models import Item, Settings


def is_low(item: Item, settings: Settings) -> bool:
    """True when the item has reached its "buy when" threshold (its own, or the default)."""
    if item.mode == "level":
        threshold = item.buyWhenLevel if item.buyWhenLevel is not None else settings.buyWhenLevel
        return item.level <= threshold
    threshold = item.buyWhenCount if item.buyWhenCount is not None else settings.buyWhenCount
    return item.count <= threshold
