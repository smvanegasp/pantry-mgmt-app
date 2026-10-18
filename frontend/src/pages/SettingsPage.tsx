import { useState, type FormEvent } from "react";

import type { Category } from "../api";
import { useCategories, useCreateCategory, useDeleteCategory, useRenameCategory } from "../hooks";

function CategoryRow({ category }: { category: Category }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const rename = useRenameCategory();
  const remove = useDeleteCategory();

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim() && name.trim() !== category.name) {
      await rename.mutateAsync({ id: category.id, name: name.trim() });
    }
    setEditing(false);
  }

  function confirmDelete() {
    if (confirm(`Delete "${category.name}"? Its items will move to "No category".`)) {
      remove.mutate(category.id);
    }
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="flex gap-2">
          <input
            autoFocus
            aria-label="Category name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-base"
          />
          <button className="rounded-lg bg-emerald-600 px-4 font-medium text-white">Save</button>
          <button
            type="button"
            onClick={() => {
              setName(category.name);
              setEditing(false);
            }}
            className="px-2 text-stone-500"
          >
            Cancel
          </button>
        </form>
        {rename.error && <p className="mt-1 text-sm text-red-600">{rename.error.message}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2">
      <span className="flex-1 text-base">{category.name}</span>
      <button onClick={() => setEditing(true)} className="rounded-lg px-3 py-1.5 text-sm text-emerald-700">
        Rename
      </button>
      <button
        onClick={confirmDelete}
        disabled={remove.isPending}
        className="rounded-lg px-3 py-1.5 text-sm text-red-600"
      >
        Delete
      </button>
    </li>
  );
}

export function SettingsPage() {
  const categories = useCategories();
  const create = useCreateCategory();
  const [name, setName] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync(name.trim());
    setName("");
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Categories</h2>
      <p className="mb-3 text-sm text-stone-500">Group your pantry however you like.</p>

      <form onSubmit={add} className="flex gap-2">
        <input
          aria-label="New category name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Spices"
          className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-base"
        />
        <button
          disabled={!name.trim() || create.isPending}
          className="rounded-lg bg-emerald-600 px-4 font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {create.error && <p className="mt-1 text-sm text-red-600">{create.error.message}</p>}

      {categories.data?.length === 0 && (
        <p className="mt-4 text-sm text-stone-500">No categories yet.</p>
      )}
      <ul className="mt-2 divide-y divide-stone-100">
        {categories.data?.map((c) => <CategoryRow key={c.id} category={c} />)}
      </ul>
    </section>
  );
}
