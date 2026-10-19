import { CaretDown, CaretRight, Plus } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";

import type { Category, ItemInput, Level, Mode, Package } from "../api";
import { useCreateCategory, useSettings } from "../hooks";
import { LEVELS, levelLabel } from "../lib/levels";
import { newPackage } from "../lib/packages";
import { CountStepper } from "./CountStepper";
import { ExpiryPicker } from "./ExpiryPicker";
import { InfoTip } from "./InfoTip";
import { LevelPicker } from "./LevelPicker";
import { PackageCarousel } from "./PackageCarousel";

interface Props {
  initial?: ItemInput;
  categories: Category[];
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onSubmit: (item: ItemInput) => void;
  onDelete?: () => void;
}

const NEW_CATEGORY = "__new__";
const MAX_PACKAGES = 20;

const label = "mb-1.5 block text-sm font-medium text-stone-600";

function PackageFields({
  mode,
  pkg,
  onChange,
}: {
  mode: Mode;
  pkg: Package;
  onChange: (pkg: Package) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <span className={label}>{mode === "level" ? "How full is it?" : "How many?"}</span>
        {mode === "level" ? (
          <LevelPicker value={pkg.level} onChange={(level) => onChange({ ...pkg, level })} />
        ) : (
          <CountStepper value={pkg.count} onChange={(count) => onChange({ ...pkg, count })} />
        )}
      </div>
      <div>
        <span className={label}>Expiration date (optional)</span>
        <ExpiryPicker value={pkg.expiresOn} onChange={(expiresOn) => onChange({ ...pkg, expiresOn })} />
      </div>
    </div>
  );
}

export function ItemForm({
  initial,
  categories,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onDelete,
}: Props) {
  const [item, setItem] = useState<ItemInput>(
    () =>
      initial ?? {
        name: "",
        categoryId: null,
        mode: "level",
        buyWhenLevel: null,
        buyWhenCount: null,
        packages: [newPackage()],
      },
  );
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [addedPackageId, setAddedPackageId] = useState<string | null>(null);
  const [showBuyWhen, setShowBuyWhen] = useState(
    initial?.buyWhenLevel != null || initial?.buyWhenCount != null,
  );
  const createCategory = useCreateCategory();
  const settings = useSettings();

  const set = <K extends keyof ItemInput>(key: K, value: ItemInput[K]) =>
    setItem((prev) => ({ ...prev, [key]: value }));

  const setPackage = (pkg: Package) =>
    set(
      "packages",
      item.packages.map((p) => (p.id === pkg.id ? pkg : p)),
    );

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

  const several = item.packages.length > 1;

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
        <span className={`${label} flex items-center gap-1.5`}>
          Track by
          <InfoTip title="How full vs. how many">
            Use <b>How full</b> for things you use a bit at a time (rice, oil, coffee) and{" "}
            <b>How many</b> for things you count (cans, eggs, bottles).
          </InfoTip>
        </span>
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
      </div>

      {several ? (
        <PackageCarousel
          packages={item.packages}
          renderPackage={(pkg) => <PackageFields mode={item.mode} pkg={pkg} onChange={setPackage} />}
          focusId={addedPackageId}
          onRemove={(id) =>
            set(
              "packages",
              item.packages.filter((p) => p.id !== id),
            )
          }
        />
      ) : (
        <PackageFields mode={item.mode} pkg={item.packages[0]} onChange={setPackage} />
      )}

      {item.packages.length < MAX_PACKAGES && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const pkg = newPackage();
              set("packages", [...item.packages, pkg]);
              setAddedPackageId(pkg.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-700"
          >
            <Plus size={16} weight="bold" aria-hidden /> Add another package
          </button>
          <InfoTip title="Packages">
            Have an open bag and a spare, or cans that expire on different dates? Add each as a
            package. The grocery list looks at the <b>total</b>, and the quick buttons on the
            pantry card change the open (or first-to-expire) package.
          </InfoTip>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowBuyWhen((s) => !s)}
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700"
            aria-expanded={showBuyWhen}
          >
            {showBuyWhen ? (
              <CaretDown size={14} weight="bold" aria-hidden />
            ) : (
              <CaretRight size={14} weight="bold" aria-hidden />
            )}
            Add to grocery list when…
          </button>
          <InfoTip title="Add to list when">
            "Generate list" adds this item once its total drops to this point. Leave it on Default
            to use the pantry-wide setting from Settings.
          </InfoTip>
        </div>
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
                <option value="">Default (at {levelLabel(settings.buyWhenLevel)} or less)</option>
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
                  placeholder={String(settings.buyWhenCount)}
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
