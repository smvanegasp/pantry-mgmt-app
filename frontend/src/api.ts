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
  /** "<space>/<id>" from uploadPhoto; null when there's no photo. */
  photoKey: string | null;
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

/**
 * "How full" items get `quantity` new full packages; "how many" items get one package
 * holding `quantity`. Free-text entries need `newItem` to become pantry items.
 */
export interface RestockInput {
  quantity: number;
  expiresOn: string | null;
  newItem?: { name: string; categoryId: string | null; mode: Mode };
}

export interface SessionInfo {
  role: "owner" | "guest" | null;
  /** Unix seconds when a guest sandbox expires. */
  expiresAt: number | null;
  ownerLoginEnabled: boolean;
}

/** Fired when the API says the session is gone (e.g. the 24h demo expired). */
export const SESSION_EXPIRED = "pantry:session-expired";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies set their own multipart Content-Type.
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: isForm ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/session")) {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
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

/** What a photo looks like; always reviewed by the user before saving. */
export interface Suggestion {
  isProduct: boolean;
  name: string;
  categoryId: string | null;
  /** A category the model suggests that doesn't exist yet. */
  newCategoryName: string | null;
  mode: Mode;
  count: number | null;
  expiresOn: string | null;
}

export function photoUrl(photoKey: string, size: "full" | "thumb" = "full"): string {
  return `/api/photos/${photoKey}${size === "thumb" ? "?size=thumb" : ""}`;
}

export const api = {
  uploadPhoto: (photo: Blob, thumb: Blob) => {
    const form = new FormData();
    form.append("photo", photo, "photo.jpg");
    form.append("thumb", thumb, "thumb.jpg");
    return request<{ photoKey: string }>("/photos", { method: "POST", body: form });
  },
  recognize: (photoKey: string) => request<Suggestion>("/recognize", json("POST", { photoKey })),

  getSession: () => request<SessionInfo>("/session"),
  startGuest: () => request<SessionInfo>("/session/guest", { method: "POST" }),
  resetGuest: () => request<SessionInfo>("/session/guest/reset", { method: "POST" }),
  ownerLogin: (passcode: string) =>
    request<SessionInfo>("/session/owner", json("POST", { passcode })),
  logout: () => request<SessionInfo>("/session", { method: "DELETE" }),

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
  restock: (entryId: string, body: RestockInput) =>
    request<Item>(`/list/${entryId}/restock`, json("POST", body)),
};
