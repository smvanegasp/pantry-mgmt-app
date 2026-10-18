import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Item, type ItemInput } from "./api";

const ITEMS = ["items"];
const CATEGORIES = ["categories"];

export const useItems = () => useQuery({ queryKey: ITEMS, queryFn: api.listItems });
export const useCategories = () => useQuery({ queryKey: CATEGORIES, queryFn: api.listCategories });

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
    onSettled: () => qc.invalidateQueries({ queryKey: ITEMS }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ITEMS }),
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
