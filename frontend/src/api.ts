export type Level = 0 | 25 | 50 | 75 | 100;
export type Mode = "level" | "count";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string | null;
  mode: Mode;
  level: Level;
  count: number;
  buyWhenLevel: Level | null;
  buyWhenCount: number | null;
  expiresOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ItemInput = Omit<Item, "id" | "createdAt" | "updatedAt">;

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
};
