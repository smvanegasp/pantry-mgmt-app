import { Basket, Plus } from "@phosphor-icons/react";
import { useState } from "react";

import type { Item, ItemInput } from "../api";
import { BottomSheet } from "../components/BottomSheet";
import { ItemCard } from "../components/ItemCard";
import { ItemForm } from "../components/ItemForm";
import { PantryControls } from "../components/PantryControls";
import {
  useCategories,
  useCreateItem,
  useDeleteItem,
  useItems,
  useList,
  useSettings,
  useUpdateItem,
} from "../hooks";
import {
  filterItems,
  groupItems,
  type ItemQuery,
  type SortKey,
  type StatusFilter,
} from "../lib/items";
import { usePersistentState } from "../lib/usePersistentState";

type Sheet = { kind: "new" } | { kind: "edit"; item: Item } | null;

type ViewPrefs = { status: StatusFilter; categoryId: string | null; sort: SortKey };

const DEFAULT_VIEW: ViewPrefs = { status: "all", categoryId: null, sort: "category" };

function toInput({ id: _id, createdAt: _c, updatedAt: _u, ...input }: Item): ItemInput {
  return input;
}

export function PantryPage() {
  const items = useItems();
  const categories = useCategories();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const settings = useSettings();
  const list = useList();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState("");
  // Filters and sort are remembered between visits; the search text is not.
  const [view, setView] = usePersistentState<ViewPrefs>("pantry.view", DEFAULT_VIEW);

  const allItems = items.data ?? [];
  const allCategories = categories.data ?? [];
  // A remembered category that has since been deleted falls back to "all".
  const categoryId =
    view.categoryId === "none" || allCategories.some((c) => c.id === view.categoryId)
      ? view.categoryId
      : null;
  const query: ItemQuery = { ...view, categoryId, search };

  const setQuery = ({ search: nextSearch, ...nextView }: ItemQuery) => {
    setSearch(nextSearch);
    setView(nextView);
  };

  // A pantry is a few hundred items at most, so filtering on every render is cheap.
  const groups = groupItems(
    filterItems(allItems, allCategories, query, settings),
    allCategories,
    query.sort,
    settings,
  );
  const countFor = (status: StatusFilter) =>
    filterItems(allItems, allCategories, { ...query, search: "", status }, settings).length;
  const onList = new Set((list.data ?? []).map((e) => e.itemId));
  const counts = { all: countFor("all"), low: countFor("low"), expiring: countFor("expiring") };

  const filtered = search.trim() !== "" || view.status !== "all" || categoryId !== null;

  const close = () => {
    setSheet(null);
    createItem.reset();
    updateItem.reset();
  };

  async function save(input: ItemInput) {
    if (sheet?.kind === "edit") {
      await updateItem.mutateAsync({ id: sheet.item.id, patch: input });
    } else {
      await createItem.mutateAsync(input);
    }
    close();
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await deleteItem.mutateAsync(item.id);
    close();
  }

  const total = allItems.length;

  return (
    <div className="pb-28">
      {total > 0 && (
        <PantryControls
          query={query}
          onChange={setQuery}
          categories={allCategories}
          total={total}
          counts={counts}
        />
      )}

      {items.isLoading && <p className="text-stone-500">Loading…</p>}
      {items.error && <p className="text-red-600">Couldn't load your pantry: {items.error.message}</p>}

      {items.isSuccess && total === 0 && (
        <div className="mt-16 text-center text-stone-500">
          <Basket size={48} weight="fill" className="mx-auto text-stone-300" aria-hidden />
          <p className="mt-2 font-medium">Your pantry is empty</p>
          <p className="text-sm">Tap + to add your first item.</p>
        </div>
      )}

      {total > 0 && groups.length === 0 && (
        <div className="mt-10 text-center text-stone-500">
          <p>No items match these filters.</p>
          <button
            type="button"
            onClick={() => setQuery({ ...DEFAULT_VIEW, sort: view.sort, search: "" })}
            className="mt-2 font-medium text-emerald-700"
          >
            Clear filters
          </button>
        </div>
      )}

      {filtered && groups.length > 0 && (
        <p className="mb-3 text-sm text-stone-500">
          Showing {groups.reduce((n, g) => n + g.items.length, 0)} of {total}
        </p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            {group.name !== null && (
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">
                {group.name} <span className="font-normal">· {group.items.length}</span>
              </h2>
            )}
            <ul className="space-y-2">
              {group.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  settings={settings}
                  onList={onList.has(item.id)}
                  onEdit={() => setSheet({ kind: "edit", item })}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSheet({ kind: "new" })}
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg active:bg-emerald-700"
        aria-label="Add item"
      >
        <Plus size={28} weight="bold" aria-hidden />
      </button>

      {sheet && (
        <BottomSheet title={sheet.kind === "edit" ? "Edit item" : "Add item"} onClose={close}>
          <ItemForm
            key={sheet.kind === "edit" ? sheet.item.id : "new"}
            initial={sheet.kind === "edit" ? toInput(sheet.item) : undefined}
            categories={categories.data ?? []}
            submitLabel={sheet.kind === "edit" ? "Save" : "Add to pantry"}
            submitting={createItem.isPending || updateItem.isPending}
            error={(createItem.error ?? updateItem.error ?? deleteItem.error)?.message}
            onSubmit={save}
            onDelete={sheet.kind === "edit" ? () => remove(sheet.item) : undefined}
          />
        </BottomSheet>
      )}
    </div>
  );
}
