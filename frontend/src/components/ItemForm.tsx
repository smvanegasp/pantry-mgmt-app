import { useState, type FormEvent } from "react";

import type { Category, ItemInput, Level, Mode } from "../api";
import { useCreateCategory } from "../hooks";
import { DEFAULT_BUY_WHEN_COUNT, DEFAULT_BUY_WHEN_LEVEL, LEVELS, levelLabel } from "../lib/levels";
import { CountStepper } from "./CountStepper";
import { ExpiryPicker } from "./ExpiryPicker";
import { LevelPicker } from "./LevelPicker";

interface Props {
  initial?: ItemInput;
  categories: Category[];
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onSubmit: (item: ItemInput) => void;
  onDelete?: () => void;
}

const EMPTY: ItemInput = {
  name: "",
  categoryId: null,
  mode: "level",
  level: 100,
  count: 1,
  buyWhenLevel: null,
  buyWhenCount: null,
  expiresOn: null,
};

const NEW_CATEGORY = "__new__";

export function ItemForm({
  initial,
  categories,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onDelete,
}: Props) {
  const [item, setItem] = useState<ItemInput>(initial ?? EMPTY);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [showBuyWhen, setShowBuyWhen] = useState(
    initial?.buyWhenLevel != null || initial?.buyWhenCount != null,
  );
  const createCategory = useCreateCategory();

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setItem((prev) => ({ ...prev, [key]: value }));

  async function addCategory() {
    const name = newCategory?.trim();
    if (!name) return;
    const created = await createCategory.mutateAsync(name);
    set("categoryId", created.id);
    setNewCategory(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!item.name.trim()) return;
    onSubmit({ ...item, name: item.name.trim() });
  }

  const label = "mb-1.5 block text-sm font-medium text-stone-600";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="item-name" className={label}>
          Name
        </label>
        <input
          id="item-name"
          autoFocus={!initial}
          required
          maxLength={80}
          value={item.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Olive oil"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label htmlFor="item-category" className={label}>
          Category
        </label>
        {newCategory === null ? (
          <select
            id="item-category"
            value={item.categoryId ?? ""}
            onChange={(e) =>
              e.target.value === NEW_CATEGORY
                ? setNewCategory("")
                : set("categoryId", e.target.value || null)
            }
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-base"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ New category…</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              id="item-category"
              autoFocus
              maxLength={80}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              placeholder="New category name"
              className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2.5 text-base"
            />
            <button
              type="button"
              onClick={addCategory}
              disabled={createCategory.isPending}
              className="rounded-lg bg-emerald-600 px-4 font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setNewCategory(null)}
              className="rounded-lg px-3 text-stone-500"
            >
              Cancel
            </button>
          </div>
        )}
        {createCategory.error && (
          <p className="mt-1 text-sm text-red-600">{createCategory.error.message}</p>
        )}
      </div>

      <div>
        <span className={label}>Track by</span>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1" role="radiogroup">
          {(["level", "count"] as Mode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={item.mode === mode}
              onClick={() => set("mode", mode)}
              className={`rounded-md py-2 font-medium ${
                item.mode === mode ? "bg-white shadow-sm" : "text-stone-500"
              }`}
            >
              {mode === "level" ? "How full" : "How many"}
            </button>
          ))}
        </div>
        <div className="mt-3">
          {item.mode === "level" ? (
            <LevelPicker value={item.level} onChange={(v) => set("level", v)} />
          ) : (
            <CountStepper value={item.count} onChange={(v) => set("count", v)} />
          )}
        </div>
      </div>

      <div>
        <span className={label}>Expiration date (optional)</span>
        <ExpiryPicker value={item.expiresOn} onChange={(v) => set("expiresOn", v)} />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowBuyWhen((s) => !s)}
          className="text-sm font-medium text-emerald-700"
          aria-expanded={showBuyWhen}
        >
          {showBuyWhen ? "▾" : "▸"} Add to grocery list when…
        </button>
        {showBuyWhen && (
          <div className="mt-2">
            {item.mode === "level" ? (
              <select
                aria-label="Add to list at level"
                value={item.buyWhenLevel ?? ""}
                onChange={(e) =>
                  set("buyWhenLevel", e.target.value === "" ? null : (Number(e.target.value) as Level))
                }
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-base"
              >
                <option value="">Default (at {levelLabel(DEFAULT_BUY_WHEN_LEVEL)} or less)</option>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    At {l.label} or less
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-stone-600">At</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label="Add to list at count"
                  min={0}
                  max={999}
                  value={item.buyWhenCount ?? ""}
                  placeholder={String(DEFAULT_BUY_WHEN_COUNT)}
                  onChange={(e) =>
                    set("buyWhenCount", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className="w-20 rounded-lg border border-stone-200 px-3 py-2 text-base"
                />
                <span className="text-stone-600">or fewer left</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-200 px-4 py-3 font-medium text-red-600"
          >
            Delete
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !item.name.trim()}
          className="flex-1 rounded-xl bg-emerald-600 py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
