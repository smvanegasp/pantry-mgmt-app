from app.models import Item, Mode, Package, Settings


def is_empty(package: Package, mode: Mode) -> bool:
    return (package.level if mode == "level" else package.count) == 0


def normalize_packages(packages: list[Package], mode: Mode) -> list[Package]:
    """Drop finished packages while something else is left; an item always keeps one."""
    remaining = [p for p in packages if not is_empty(p, mode)]
    return remaining or packages[:1]


def total(item: Item) -> int:
    """Total stock: summed fill percentages (two half bags = 100) or summed counts."""
    if item.mode == "level":
        return sum(p.level for p in item.packages)
    return sum(p.count for p in item.packages)


def is_low(item: Item, settings: Settings) -> bool:
    """True when total stock has reached the "buy when" threshold (its own, or the default)."""
    if item.mode == "level":
        threshold = item.buyWhenLevel if item.buyWhenLevel is not None else settings.buyWhenLevel
    else:
        threshold = item.buyWhenCount if item.buyWhenCount is not None else settings.buyWhenCount
    return total(item) <= threshold
