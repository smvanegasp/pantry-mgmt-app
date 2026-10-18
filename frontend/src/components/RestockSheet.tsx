import { ArrowCounterClockwise, CheckCircle, Prohibit } from "@phosphor-icons/react";
import { useState } from "react";

import type { Category, Item, ListEntry, Mode } from "../api";
import { useDeleteListEntry, useRestock, useUpdateListEntry } from "../hooks";
import { stockNote } from "../lib/packages";
import { BottomSheet } from "./BottomSheet";
import { CountStepper } from "./CountStepper";
import { ExpiryPicker } from "./ExpiryPicker";
import { InfoTip } from "./InfoTip";

/** What the user filled in on one card. Name/category/mode only apply to free-text entries. */
interface Draft {
  quantity: number;
  expiresOn: string | null;
  name: string;
  categoryId: string | null;
  mode: Mode;
}

type Status = "pending" | "saving" | "done" | "notBought" | "untracked" | "error";

interface Props {
  /** The entries that were in the cart when the sheet opened. */
  entries: ListEntry[];
  itemsById: Map<string, Item>;
  categories: Category[];
  onClose: () => void;
}

const DONE_LABEL: Partial<Record<Status, string>> = {
  done: "Put away",
  notBought: "Back on the list",
  untracked: "Not tracked",
};

export function RestockSheet({ entries, itemsById, categories, onClose }: Props) {
  const restock = useRestock();
  const update = useUpdateListEntry();
  const remove = useDeleteListEntry();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      entries.map((e) => [
        e.id,
        { quantity: 1, expiresOn: null, name: e.name, categoryId: null, mode: "level" as Mode },
      ]),
    ),
  );
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const linkedItem = (e: ListEntry) => (e.itemId ? itemsById.get(e.itemId) : undefined);
  const statusOf = (e: ListEntry): Status => status[e.id] ?? "pending";
  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const mark = (id: string, s: Status) => setStatus((prev) => ({ ...prev, [id]: s }));

  const pending = entries.filter((e) => ["pending", "error"].includes(statusOf(e)));
  const handled = entries.filter((e) => DONE_LABEL[statusOf(e)]);
  const linkedPending = pending.filter((e) => linkedItem(e));

  async function putAway(entry: ListEntry) {
    const draft = drafts[entry.id];
    mark(entry.id, "saving");
    try {
      await restock.mutateAsync({
        entryId: entry.id,
        body: {
          quantity: draft.quantity,
          expiresOn: draft.expiresOn,
          newItem: linkedItem(entry)
            ? undefined
            : { name: draft.name.trim() || entry.name, categoryId: draft.categoryId, mode: draft.mode },
        },
      });
      mark(entry.id, "done");
    } catch (err) {
      setErrors((prev) => ({ ...prev, [entry.id]: (err as Error).message }));
      mark(entry.id, "error");
    }
  }

  async function putAwayAll() {
    // Sequential keeps it simple and gentle on the API; it's a handful of items.
    for (const entry of linkedPending) await putAway(entry);
  }

  function notBought(entry: ListEntry) {
    update.mutate({ id: entry.id, patch: { checked: false } });
    mark(entry.id, "notBought");
  }

  function untracked(entry: ListEntry) {
    remove.mutate(entry.id);
    mark(entry.id, "untracked");
  }

  return (
    <BottomSheet title="Put groceries away" onClose={onClose}>
      <div className="space-y-4">
        {pending.length > 0 && (
          <div className="flex items-start gap-1.5 text-sm text-stone-600">
            <p>
              Each item you bought becomes a new package in your pantry. Add an expiration date if
              you like, or skip it.
            </p>
            <InfoTip title="Putting groceries away" align="right">
              For <b>how full</b> items, the quantity is how many new full packages you bought.
              For <b>how many</b> items, it's how many you bought (they're added as one batch).
              Anything you didn't find goes back on the list.
            </InfoTip>
          </div>
        )}

        {linkedPending.length > 1 && (
          <button
            type="button"
            onClick={putAwayAll}
            disabled={restock.isPending}
            className="w-full rounded-xl border-2 border-emerald-600 py-2.5 font-semibold text-emerald-700 disabled:opacity-50"
          >
            Put away all {linkedPending.length} as shown
          </button>
        )}

        <ul className="space-y-3">
          {pending.map((entry) => {
            const item = linkedItem(entry);
            const draft = drafts[entry.id];
            const mode = item?.mode ?? draft.mode;
            const saving = statusOf(entry) === "saving";
            return (
              <li key={entry.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                {item ? (
                  <div className="mb-3">
                    <p className="text-base font-semibold">{item.name}</p>
                    <p className="text-xs text-stone-500">Now: {stockNote(item)}</p>
                  </div>
                ) : (
                  <div className="mb-3 space-y-2">
                    <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
                      New to your pantry
                    </p>
                    <input
                      aria-label="Item name"
                      maxLength={80}
                      value={draft.name}
                      onChange={(e) => setDraft(entry.id, { name: e.target.value })}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-base font-semibold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="Category"
                        value={draft.categoryId ?? ""}
                        onChange={(e) => setDraft(entry.id, { categoryId: e.target.value || null })}
                        className="min-w-0 rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm"
                      >
                        <option value="">No category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1" role="radiogroup" aria-label="Track by">
                        {(["level", "count"] as Mode[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={draft.mode === m}
                            onClick={() => setDraft(entry.id, { mode: m })}
                            className={`rounded-md text-sm font-medium ${
                              draft.mode === m ? "bg-white shadow-sm" : "text-stone-500"
                            }`}
                          >
                            {m === "level" ? "How full" : "How many"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-stone-600">
                    {mode === "level" ? "Packages bought" : "How many bought"}
                  </span>
                  <CountStepper
                    compact
                    min={1}
                    value={draft.quantity}
                    onChange={(quantity) => setDraft(entry.id, { quantity })}
                  />
                </div>

                <ExpiryPicker
                  compact
                  value={draft.expiresOn}
                  onChange={(expiresOn) => setDraft(entry.id, { expiresOn })}
                />

                {errors[entry.id] && statusOf(entry) === "error" && (
                  <p className="mt-2 text-sm text-red-600">{errors[entry.id]}</p>
                )}

                <button
                  type="button"
                  onClick={() => putAway(entry)}
                  disabled={saving}
                  className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : item ? "Put away" : "Add to pantry"}
                </button>
                <div className="mt-1 flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => notBought(entry)}
                    className="inline-flex items-center gap-1 px-2 py-2 text-sm text-stone-500"
                  >
                    <ArrowCounterClockwise size={14} weight="bold" aria-hidden /> Didn't get it
                  </button>
                  {!item && (
                    <button
                      type="button"
                      onClick={() => untracked(entry)}
                      className="inline-flex items-center gap-1 px-2 py-2 text-sm text-stone-500"
                    >
                      <Prohibit size={14} weight="bold" aria-hidden /> Don't track it
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {handled.length > 0 && (
          <ul className="space-y-1.5" aria-label="Done">
            {handled.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 text-sm text-stone-500">
                <CheckCircle size={18} weight="fill" className="text-emerald-600" aria-hidden />
                <span className="flex-1">{drafts[entry.id].name || entry.name}</span>
                <span>{DONE_LABEL[statusOf(entry)]}</span>
              </li>
            ))}
          </ul>
        )}

        {pending.length === 0 && (
          <div className="pt-2 text-center">
            <CheckCircle size={48} weight="fill" className="mx-auto text-emerald-600" aria-hidden />
            <p className="mt-2 text-lg font-semibold">All put away</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-xl bg-stone-800 py-3 font-semibold text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
