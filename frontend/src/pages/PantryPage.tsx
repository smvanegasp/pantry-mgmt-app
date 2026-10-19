import { Basket, Camera, CameraPlus, CaretDown, CaretRight, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import type { Item, ItemInput } from "../api";
import { AddMenu } from "../components/AddMenu";
import { BottomSheet } from "../components/BottomSheet";
import { ItemCard } from "../components/ItemCard";
import { ItemForm } from "../components/ItemForm";
import { PantryControls } from "../components/PantryControls";
import { StockUpSheet } from "../components/StockUpSheet";
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
  isLow,
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
  const [stockingUp, setStockingUp] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [search, setSearch] = useState("");
  // Filters and sort are remembered between visits; the search text is not.
  const [view, setView] = usePersistentState<ViewPrefs>("pantry.view", DEFAULT_VIEW);
  // Folded category sections, remembered between visits.
  const [folded, setFolded] = usePersistentState<{ ids: string[] }>("pantry.folded", { ids: [] });

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
  const searching = search.trim() !== "";
  const grouped = groups.some((g) => g.name !== null);
  const allFolded = grouped && groups.every((g) => folded.ids.includes(g.key));
  const toggleFold = (key: string) =>
    setFolded({ ids: folded.ids.includes(key) ? folded.ids.filter((k) => k !== key) : [...folded.ids, key] });

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
          <p className="text-sm">Snap a photo of each product and it's filled in for you.</p>
          <button
            type="button"
            onClick={() => setStockingUp(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white"
          >
            <CameraPlus size={22} weight="fill" aria-hidden /> Stock your pantry with photos
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: "new" })}
            className="mt-3 block w-full text-sm font-medium text-emerald-700"
          >
            Or add one item at a time
          </button>
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

      {groups.length > 0 && (filtered || grouped) && (
        <div className="mb-3 flex items-center justify-between text-sm text-stone-500">
          <span>{filtered && `Showing ${groups.reduce((n, g) => n + g.items.length, 0)} of ${total}`}</span>
          {grouped && !searching && (
            <button
              type="button"
              onClick={() => setFolded({ ids: allFolded ? [] : groups.map((g) => g.key) })}
              className="font-medium text-emerald-700"
            >
              {allFolded ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>
      )}

      <div className="space-y-6">
        {groups.map((group) => {
          // Searching shows every match, even in folded sections.
          const open = group.name === null || searching || !folded.ids.includes(group.key);
          const low = group.items.filter((i) => isLow(i, settings)).length;
          return (
            <section key={group.key}>
              {group.name !== null && (
                <h2 className="mb-2">
                  <button
                    type="button"
                    onClick={() => toggleFold(group.key)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-1.5 py-1 text-left text-sm font-semibold tracking-wide text-stone-500 uppercase"
                  >
                    {open ? (
                      <CaretDown size={14} weight="bold" aria-hidden />
                    ) : (
                      <CaretRight size={14} weight="bold" aria-hidden />
                    )}
                    {group.name} <span className="font-normal">· {group.items.length}</span>
                    {!open && low > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tracking-normal text-amber-800 normal-case">
                        <WarningCircle size={12} weight="fill" aria-hidden /> {low} low
                      </span>
                    )}
                  </button>
                </h2>
              )}
              {open && (
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
              )}
            </section>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setAddMenu(true)}
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35),0_2px_4px_rgba(0,0,0,0.25)] active:bg-emerald-700"
        aria-label="Add to pantry"
      >
        <Camera size={28} weight="fill" aria-hidden />
      </button>

      {addMenu && (
        <AddMenu
          onClose={() => setAddMenu(false)}
          onStockUp={() => {
            setAddMenu(false);
            setStockingUp(true);
          }}
          onAddOne={() => {
            setAddMenu(false);
            setSheet({ kind: "new" });
          }}
        />
      )}

      {stockingUp && <StockUpSheet onClose={() => setStockingUp(false)} />}

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
