import { useMemo, useState } from "react";

import type { Category, Item, ItemInput } from "../api";
import { BottomSheet } from "../components/BottomSheet";
import { ItemCard } from "../components/ItemCard";
import { ItemForm } from "../components/ItemForm";
import { useCategories, useCreateItem, useDeleteItem, useItems, useUpdateItem } from "../hooks";

type Sheet = { kind: "new" } | { kind: "edit"; item: Item } | null;

function toInput({ id: _id, createdAt: _c, updatedAt: _u, ...input }: Item): ItemInput {
  return input;
}

function groupByCategory(items: Item[], categories: Category[]) {
  const groups = categories
    .map((c) => ({ key: c.id, name: c.name, items: items.filter((i) => i.categoryId === c.id) }))
    .filter((g) => g.items.length > 0);
  const known = new Set(categories.map((c) => c.id));
  const other = items.filter((i) => !i.categoryId || !known.has(i.categoryId));
  if (other.length) groups.push({ key: "none", name: "No category", items: other });
  return groups;
}

export function PantryPage() {
  const items = useItems();
  const categories = useCategories();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = (items.data ?? []).filter((i) => i.name.toLowerCase().includes(term));
    return groupByCategory(visible, categories.data ?? []);
  }, [items.data, categories.data, search]);

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

  const total = items.data?.length ?? 0;

  return (
    <div className="pb-28">
      {total > 0 && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${total} item${total === 1 ? "" : "s"}`}
          className="mb-4 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-base"
        />
      )}

      {items.isLoading && <p className="text-stone-500">Loading…</p>}
      {items.error && <p className="text-red-600">Couldn't load your pantry: {items.error.message}</p>}

      {items.isSuccess && total === 0 && (
        <div className="mt-16 text-center text-stone-500">
          <p className="text-4xl">🥫</p>
          <p className="mt-2 font-medium">Your pantry is empty</p>
          <p className="text-sm">Tap + to add your first item.</p>
        </div>
      )}

      {total > 0 && groups.length === 0 && (
        <p className="text-center text-stone-500">No items match "{search}".</p>
      )}

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.key}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              {group.name} <span className="font-normal">· {group.items.length}</span>
            </h2>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <ItemCard key={item.id} item={item} onEdit={() => setSheet({ kind: "edit", item })} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSheet({ kind: "new" })}
        className="fixed right-5 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 h-14 w-14 rounded-full bg-emerald-600 text-3xl text-white shadow-lg active:bg-emerald-700"
        aria-label="Add item"
      >
        +
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
