import { useState } from "react";

import type { Item, ListEntry } from "../api";
import { AddToList } from "../components/AddToList";
import {
  useCategories,
  useDeleteListEntry,
  useGenerateList,
  useItems,
  useList,
  useSettings,
  useUpdateListEntry,
} from "../hooks";
import { groupByCategory } from "../lib/items";
import { levelLabel } from "../lib/levels";

function stockNote(item: Item | undefined): string | null {
  if (!item) return null;
  if (item.mode === "count") return `${item.count} left`;
  return item.level === 0 ? "Empty" : `${levelLabel(item.level)} left`;
}

function EntryRow({ entry, item }: { entry: ListEntry; item?: Item }) {
  const update = useUpdateListEntry();
  const remove = useDeleteListEntry();
  const note = stockNote(item);

  return (
    <li className="flex items-center rounded-xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        role="checkbox"
        aria-checked={entry.checked}
        onClick={() => update.mutate({ id: entry.id, patch: { checked: !entry.checked } })}
        className="flex min-h-14 flex-1 items-center gap-3 px-3 py-2 text-left"
      >
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${
            entry.checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300"
          }`}
        >
          {entry.checked && "✓"}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-base font-medium ${entry.checked ? "text-stone-400 line-through" : ""}`}
          >
            {entry.name}
          </span>
          {note && !entry.checked && <span className="text-xs text-stone-500">{note}</span>}
        </span>
      </button>
      <button
        type="button"
        onClick={() => remove.mutate(entry.id)}
        aria-label={`Remove ${entry.name}`}
        className="self-stretch px-4 text-xl text-stone-400 active:text-red-600"
      >
        ×
      </button>
    </li>
  );
}

export function ListPage() {
  const list = useList();
  const items = useItems();
  const categories = useCategories();
  const settings = useSettings();
  const generate = useGenerateList();
  const [message, setMessage] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(true);

  const entries = list.data ?? [];
  const itemsById = new Map((items.data ?? []).map((i) => [i.id, i]));
  const toBuy = entries.filter((e) => !e.checked);
  const inCart = entries.filter((e) => e.checked);
  const groups = groupByCategory(
    toBuy,
    categories.data ?? [],
    (e) => (e.itemId ? (itemsById.get(e.itemId)?.categoryId ?? null) : null),
    "Other",
  );

  async function generateList() {
    const { added } = await generate.mutateAsync();
    setMessage(
      added.length === 0
        ? "Nothing new is running low."
        : `Added ${added.length} item${added.length === 1 ? "" : "s"} that ${added.length === 1 ? "is" : "are"} running low.`,
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <button
          type="button"
          onClick={generateList}
          disabled={generate.isPending}
          className="w-full rounded-xl bg-emerald-600 py-3.5 text-lg font-semibold text-white shadow-sm active:bg-emerald-700 disabled:opacity-60"
        >
          {generate.isPending ? "Checking pantry…" : "✨ Generate list"}
        </button>
        <p className="mt-1.5 text-center text-sm text-stone-500" aria-live="polite">
          {generate.error
            ? generate.error.message
            : (message ??
              `Adds everything at ${levelLabel(settings.buyWhenLevel)} or less, or ${settings.buyWhenCount} or fewer left.`)}
        </p>
      </div>

      <AddToList items={items.data ?? []} onListIds={new Set(entries.map((e) => e.itemId))} />

      {list.isLoading && <p className="text-stone-500">Loading…</p>}
      {list.error && <p className="text-red-600">Couldn't load the list: {list.error.message}</p>}

      {list.isSuccess && entries.length === 0 && (
        <div className="mt-10 text-center text-stone-500">
          <p className="text-4xl">🛒</p>
          <p className="mt-2 font-medium">Your grocery list is empty</p>
          <p className="text-sm">Generate it from your pantry or add things above.</p>
        </div>
      )}

      {entries.length > 0 && (
        <p className="text-sm font-medium text-stone-600">
          {inCart.length} of {entries.length} in cart
        </p>
      )}

      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            {group.name}
          </h2>
          <ul className="space-y-2">
            {group.items.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                item={entry.itemId ? itemsById.get(entry.itemId) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}

      {entries.length > 0 && toBuy.length === 0 && (
        <p className="text-center font-medium text-emerald-700">Everything's in the cart 🎉</p>
      )}

      {inCart.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowCart((s) => !s)}
            aria-expanded={showCart}
            className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase"
          >
            {showCart ? "▾" : "▸"} In cart · {inCart.length}
          </button>
          {showCart && (
            <ul className="space-y-2">
              {inCart.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
