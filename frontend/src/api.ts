export type Level = 0 | 25 | 50 | 75 | 100;
export type Mode = "level" | "count";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

/** One physical container (bag, bottle, batch of cans); uses `level` or `count` per the item's mode. */
export interface Package {
  id: string;
  level: Level;
  count: number;
  expiresOn: string | null;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string | null;
  mode: Mode;
  buyWhenLevel: Level | null;
  buyWhenCount: number | null;
  packages: Package[];
  createdAt: string;
  updatedAt: string;
}

export type ItemInput = Omit<Item, "id" | "createdAt" | "updatedAt">;

export interface Settings {
  buyWhenLevel: Level;
  buyWhenCount: number;
}

export interface ListEntry {
  id: string;
  itemId: string | null;
  name: string;
  checked: boolean;
  addedBy: "auto" | "manual";
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const api = {
  listItems: () => request<Item[]>("/items"),
  createItem: (item: ItemInput) => request<Item>("/items", json("POST", item)),
  updateItem: (id: string, patch: Partial<ItemInput>) =>
    request<Item>(`/items/${id}`, json("PATCH", patch)),
  deleteItem: (id: string) => request<void>(`/items/${id}`, { method: "DELETE" }),

  listCategories: () => request<Category[]>("/categories"),
  createCategory: (name: string) => request<Category>("/categories", json("POST", { name })),
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "sortOrder">>) =>
    request<Category>(`/categories/${id}`, json("PATCH", patch)),
  deleteCategory: (id: string) => request<void>(`/categories/${id}`, { method: "DELETE" }),

  getSettings: () => request<Settings>("/settings"),
  updateSettings: (settings: Settings) => request<Settings>("/settings", json("PUT", settings)),

  getList: () => request<ListEntry[]>("/list"),
  addToList: (entry: { itemId: string } | { name: string }) =>
    request<ListEntry>("/list", json("POST", entry)),
  generateList: () =>
    request<{ added: ListEntry[]; list: ListEntry[] }>("/list/generate", { method: "POST" }),
  updateListEntry: (id: string, patch: Partial<Pick<ListEntry, "checked" | "name">>) =>
    request<ListEntry>(`/list/${id}`, json("PATCH", patch)),
  deleteListEntry: (id: string) => request<void>(`/list/${id}`, { method: "DELETE" }),
};
