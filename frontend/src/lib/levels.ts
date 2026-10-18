import type { Level } from "../api";

export const LEVELS: { value: Level; label: string }[] = [
  { value: 0, label: "Empty" },
  { value: 25, label: "¼" },
  { value: 50, label: "½" },
  { value: 75, label: "¾" },
  { value: 100, label: "Full" },
];

export const levelLabel = (level: Level) => LEVELS.find((l) => l.value === level)?.label ?? "";

// Pantry-wide defaults; become editable settings in stage 2.
export const DEFAULT_BUY_WHEN_LEVEL: Level = 25;
export const DEFAULT_BUY_WHEN_COUNT = 1;
