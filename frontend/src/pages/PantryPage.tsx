import { Camera, CameraPlus, CaretDown, CaretRight, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import type { Item, ItemInput } from "../api";
import { AddMenu } from "../components/AddMenu";
import { BottomSheet } from "../components/BottomSheet";
import { ItemCard } from "../components/ItemCard";
import { ItemForm } from "../components/ItemForm";
import { EmptyState } from "../components/Mascot";
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
import { addTo } from "../lib/stockup";
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

  /** "Add one product" for something already in the pantry: add to it, don't duplicate it. */
  async function saveInto(existing: Item, input: ItemInput) {
    await updateItem.mutateAsync({ id: existing.id, patch: addTo(existing, input.packages, input.photoKey) });
    close();
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await deleteItem.mutateAsync(item.id);
    close();
  }

  const total = allItems.length;

  // Computers: "/" jumps to search, like most web apps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.closest("input, textarea, select, [contenteditable]")) return;
      const box = document.querySelector<HTMLInputElement>('input[inputmode="search"]');
      if (box) {
        e.preventDefault();
        box.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
        <EmptyState title="Your pantry is empty">
          <p className="text-sm">Snap a photo of each product and it's filled in for you.</p>
          <button
            type="button"
            onClick={() => setStockingUp(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 font-bold text-white shadow-lg"
          >
            <CameraPlus size={22} weight="fill" aria-hidden /> Stock your pantry with photos
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: "new" })}
            className="mt-3 block w-full text-sm font-bold text-emerald-700"
          >
            Or add one item at a time
          </button>
        </EmptyState>
      )}

      {total > 0 && groups.length === 0 && (
        <EmptyState title="Nothing matches">
          <p className="text-sm">Try another word or filter.</p>
          <button
            type="button"
            onClick={() => setQuery({ ...DEFAULT_VIEW, sort: view.sort, search: "" })}
            className="mt-3 rounded-full bg-emerald-100 px-4 py-2 font-bold text-emerald-800"
          >
            Clear filters
          </button>
        </EmptyState>
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

      <div className="space-y-7">
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
                    className="flex w-full items-center gap-1.5 rounded-full py-1 text-left text-sm font-extrabold tracking-wide text-stone-600"
                  >
                    {open ? (
                      <CaretDown size={14} weight="bold" aria-hidden />
                    ) : (
                      <CaretRight size={14} weight="bold" aria-hidden />
                    )}
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                    {group.name}{" "}
                    <span className="rounded-full bg-stone-100 px-2 text-xs font-bold text-stone-500">{group.items.length}</span>
                    {!open && low > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tracking-normal text-amber-800 normal-case">
                        <WarningCircle size={12} weight="fill" aria-hidden /> {low} low
                      </span>
                    )}
                  </button>
                </h2>
              )}
              {open && (
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 md:right-10 md:bottom-10 md:h-auto md:w-auto md:gap-2 md:px-6 md:py-4 md:font-bold"
        aria-label="Add products"
      >
        <Camera size={28} weight="fill" aria-hidden />
        <span className="hidden md:inline">Add products</span>
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
            lockMode={sheet.kind === "edit"}
            items={allItems}
            onAddTo={sheet.kind === "new" ? saveInto : undefined}
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
