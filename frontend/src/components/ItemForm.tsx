import { Basket, CaretDown, CaretRight, Plus, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";

import {
  api,
  type Category,
  type Item,
  type ItemInput,
  type Level,
  type Mode,
  type Package,
  type Suggestion,
} from "../api";
import { useCreateCategory, useSettings } from "../hooks";
import { LEVELS, levelLabel } from "../lib/levels";
import { newPackage, stockNote } from "../lib/packages";
import { findMatch } from "../lib/stockup";
import { CountStepper } from "./CountStepper";
import { ExpiryPicker } from "./ExpiryPicker";
import { InfoTip } from "./InfoTip";
import { LevelPicker } from "./LevelPicker";
import { PackageCarousel } from "./PackageCarousel";
import { PhotoField } from "./Photo";

interface Props {
  initial?: ItemInput;
  /** Saved items: "Track by" sits behind a Change link so it isn't switched by accident. */
  lockMode?: boolean;
  /** The pantry, to offer adding to an item that looks like the same product. */
  items?: Item[];
  /** Add this form's packages to an existing item instead of creating a duplicate. */
  onAddTo?: (existing: Item, input: ItemInput) => void;
  categories: Category[];
  submitLabel: string;
  submitting: boolean;
  error?: string;
  onSubmit: (item: ItemInput) => void;
  onDelete?: () => void;
}

const NEW_CATEGORY = "__new__";

type ReadingState = { state: "idle" | "reading" | "done" | "notProduct" } | { state: "error"; message: string };

function PhotoReading({
  state,
  canRead,
  onRead,
}: {
  state: ReadingState;
  canRead: boolean;
  onRead: () => void;
}) {
  const box = "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm";
  switch (state.state) {
    case "reading":
      return (
        <p className={`${box} bg-emerald-50 text-emerald-800`} aria-live="polite">
          <Sparkle size={18} weight="fill" className="shrink-0 animate-pulse" aria-hidden />
          Reading the label…
        </p>
      );
    case "done":
      return (
        <p className={`${box} bg-emerald-50 text-emerald-800`} aria-live="polite">
          <Sparkle size={18} weight="fill" className="shrink-0" aria-hidden />
          Filled in from the photo. Check it's right before saving.
        </p>
      );
    case "notProduct":
      return (
        <p className={`${box} bg-amber-50 text-amber-800`} aria-live="polite">
          That doesn't look like a pantry product. Fill it in by hand, or try another photo.
        </p>
      );
    case "error":
      return (
        <p className={`${box} bg-red-50 text-red-700`} aria-live="polite">
          {state.message}
        </p>
      );
    default:
      return canRead ? (
        <button
          type="button"
          onClick={onRead}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"
        >
          <Sparkle size={16} weight="fill" aria-hidden /> Fill in from photo
        </button>
      ) : null;
  }
}
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

const MODE_LABEL: Record<Mode, string> = { level: "How full", count: "How many" };

export function ItemForm({
  initial,
  lockMode = false,
  items,
  onAddTo,
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
        photoKey: null,
      },
  );
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [addedPackageId, setAddedPackageId] = useState<string | null>(null);
  const [changingMode, setChangingMode] = useState(false);
  const [showBuyWhen, setShowBuyWhen] = useState(
    initial?.buyWhenLevel != null || initial?.buyWhenCount != null,
  );
  const createCategory = useCreateCategory();
  const settings = useSettings();
  const [reading, setReading] = useState<ReadingState>({ state: "idle" });

  /** Fill the form from what the photo shows; the user reviews it before saving. */
  function apply(s: Suggestion) {
    // A saved item keeps how it's tracked and how much there is; the photo only fills the rest.
    const keepStock = lockMode;
    setItem((prev) => ({
      ...prev,
      name: s.name || prev.name,
      categoryId: s.categoryId ?? prev.categoryId,
      mode: keepStock ? prev.mode : s.mode,
      packages: prev.packages.map((p, i) =>
        i === 0
          ? {
              ...p,
              count: keepStock ? p.count : (s.count ?? p.count),
              expiresOn: s.expiresOn ?? p.expiresOn,
            }
          : p,
      ),
    }));
    // Offer to create the suggested category instead of silently creating it.
    if (!s.categoryId && s.newCategoryName && !item.categoryId) setNewCategory(s.newCategoryName);
  }

  async function readPhoto(photoKey: string) {
    setReading({ state: "reading" });
    try {
      const suggestion = await api.recognize(photoKey);
      if (!suggestion.isProduct) {
        setReading({ state: "notProduct" });
        return;
      }
      apply(suggestion);
      setReading({ state: "done" });
    } catch (err) {
      setReading({ state: "error", message: (err as Error).message });
    }
  }

  function onPhoto(photoKey: string | null) {
    set("photoKey", photoKey);
    setReading({ state: "idle" });
    // New items are filled in automatically; existing ones only when asked.
    if (photoKey && !initial) readPhoto(photoKey);
  }

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

  // A new item that looks like one already in the pantry: offer to add to it instead. The photo
  // reader returns an existing item's exact name when it's the same product, so names suffice.
  const match = !lockMode && onAddTo && items ? findMatch(items, item.name) : null;
  // Ask the amount the way the matched item counts it ("how many" cans, not "how full").
  const matchMode = match?.item.mode;
  useEffect(() => {
    if (matchMode) setItem((prev) => ({ ...prev, mode: matchMode }));
  }, [match?.item.id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!item.name.trim()) return;
    const input = { ...item, name: item.name.trim() };
    if (match && onAddTo) onAddTo(match.item, input);
    else onSubmit(input);
  }

  function submitAsNew() {
    if (item.name.trim()) onSubmit({ ...item, name: item.name.trim() });
  }

  const several = item.packages.length > 1;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <PhotoField photoKey={item.photoKey} name={item.name} onChange={onPhoto} />
        <PhotoReading
          state={reading}
          canRead={item.photoKey !== null}
          onRead={() => item.photoKey && readPhoto(item.photoKey)}
        />
      </div>

      <div>
        <label htmlFor="item-name" className={label}>
          Name
        </label>
        <input
          id="item-name"
          required
          maxLength={80}
          value={item.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Olive oil"
          className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base"
        />
        {match && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800" aria-live="polite">
            <Basket size={18} weight="fill" className="mt-px shrink-0" aria-hidden />
            <span>
              {match.sure ? "Already in your pantry" : "Looks like one you have"}:{" "}
              <b>{match.item.name}</b> ({stockNote(match.item)}). Adding to it keeps a single entry.
            </span>
          </p>
        )}
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
              // Focus only when the user picked "+ New category…" (blank), not when a photo
              // suggested one: that would pop the keyboard up right after the camera closes.
              autoFocus={newCategory === ""}
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
        {lockMode && !changingMode ? (
          <div className="flex items-center justify-between rounded-lg bg-stone-100 px-3 py-2">
            <span className="font-medium">{MODE_LABEL[item.mode]}</span>
            <button
              type="button"
              onClick={() => setChangingMode(true)}
              className="text-sm font-medium text-emerald-700"
            >
              Change
            </button>
          </div>
        ) : (
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
                {MODE_LABEL[mode]}
              </button>
            ))}
          </div>
        )}
        {lockMode && item.mode !== initial?.mode && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <WarningCircle size={18} weight="fill" className="mt-px shrink-0" aria-hidden />
            Amounts work differently now. Check how much you have below before saving.
          </p>
        )}
      </div>

      {several ? (
        <PackageCarousel
          packages={item.packages}
          renderPackage={(pkg) => <PackageFields mode={item.mode} pkg={pkg} onChange={setPackage} />}
          focusId={addedPackageId}
          label={item.mode === "level" ? "Package" : "Expiration date"}
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
            <Plus size={16} weight="bold" aria-hidden />{" "}
            {item.mode === "level" ? "Add another package" : "Add another expiration date"}
          </button>
          {item.mode === "level" ? (
            <InfoTip title="Packages">
              Have an open bag and a spare? Add each as a package with how full it is. The grocery
              list looks at the <b>total</b>, and the quick buttons on the pantry card change the
              open (least full) one.
            </InfoTip>
          ) : (
            <InfoTip title="Expiration dates">
              Bought some at different times? Add how many expire on each date, like 6 eggs on
              Nov 2 and 6 more on Nov 16. The grocery list looks at the <b>total</b>, and the
              quick buttons on the pantry card use up the ones that expire first.
            </InfoTip>
          )}
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
          {submitting ? "Saving…" : match ? `Add to “${match.item.name}”` : submitLabel}
        </button>
      </div>
      {match && (
        <button
          type="button"
          onClick={submitAsNew}
          disabled={submitting}
          className="-mt-2 w-full py-2 text-sm font-medium text-stone-600 disabled:opacity-50"
        >
          It's a different product: add as a new item
        </button>
      )}
    </form>
  );
}
