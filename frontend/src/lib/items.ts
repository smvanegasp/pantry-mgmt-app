import type { Item } from "../api";
import { DEFAULT_BUY_WHEN_COUNT, DEFAULT_BUY_WHEN_LEVEL } from "./levels";

/** True when the item has reached its "buy when" threshold. */
export function isLow(item: Item): boolean {
  return item.mode === "level"
    ? item.level <= (item.buyWhenLevel ?? DEFAULT_BUY_WHEN_LEVEL)
    : item.count <= (item.buyWhenCount ?? DEFAULT_BUY_WHEN_COUNT);
}
