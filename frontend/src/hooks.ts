import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Item, type ItemInput, type ListEntry, type Settings } from "./api";
import { DEFAULT_SETTINGS } from "./lib/items";

const ITEMS = ["items"];
const CATEGORIES = ["categories"];
const SETTINGS = ["settings"];
const LIST = ["list"];

export const useItems = () => useQuery({ queryKey: ITEMS, queryFn: api.listItems });
export const useCategories = () => useQuery({ queryKey: CATEGORIES, queryFn: api.listCategories });

/** Pantry-wide settings; falls back to the defaults while loading. */
export function useSettings(): Settings {
  return useQuery({ queryKey: SETTINGS, queryFn: api.getSettings }).data ?? DEFAULT_SETTINGS;
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (settings) => qc.setQueryData(SETTINGS, settings),
  });
}

export const useList = () => useQuery({ queryKey: LIST, queryFn: api.getList });

export function useGenerateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.generateList,
    onSuccess: ({ list }) => qc.setQueryData(LIST, list),
  });
}

export function useAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addToList,
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST }),
  });
}

/** Optimistic so checking items off in the store feels instant. */
export function useUpdateListEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<ListEntry, "checked" | "name">> }) =>
      api.updateListEntry(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: LIST });
      const previous = qc.getQueryData<ListEntry[]>(LIST);
      qc.setQueryData<ListEntry[]>(LIST, (list) =>
        list?.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => qc.setQueryData(LIST, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: LIST }),
  });
}

export function useDeleteListEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteListEntry,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: LIST });
      const previous = qc.getQueryData<ListEntry[]>(LIST);
      qc.setQueryData<ListEntry[]>(LIST, (list) => list?.filter((e) => e.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => qc.setQueryData(LIST, context?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: LIST }),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS }),
  });
}

/** Optimistic so one-tap level/count changes feel instant. */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ItemInput> }) =>
      api.updateItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ITEMS });
      const previous = qc.getQueryData<Item[]>(ITEMS);
      qc.setQueryData<Item[]>(ITEMS, (items) =>
        items?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => qc.setQueryData(ITEMS, context?.previous),
    onSettled: (_data, _err, { patch }) => {
      qc.invalidateQueries({ queryKey: ITEMS });
      // Renames carry over to the item's grocery-list entry.
      if (patch.name !== undefined) qc.invalidateQueries({ queryKey: LIST });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS });
      qc.invalidateQueries({ queryKey: LIST });
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES }),
  });
}

export function useRenameCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateCategory(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES });
      qc.invalidateQueries({ queryKey: ITEMS });
    },
  });
}
