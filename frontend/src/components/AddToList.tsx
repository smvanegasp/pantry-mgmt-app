import { useState, type FormEvent } from "react";

import type { Item } from "../api";
import { useAddToList } from "../hooks";
import { fuzzyMatch, normalize } from "../lib/search";

interface Props {
  items: Item[];
  onListIds: Set<string | null>;
}

const MAX_SUGGESTIONS = 5;

/** Text box that suggests pantry items as you type, or adds whatever you typed. */
export function AddToList({ items, onListIds }: Props) {
  const [text, setText] = useState("");
  const add = useAddToList();

  const term = text.trim();
  const suggestions = term
    ? items.filter((i) => !onListIds.has(i.id) && fuzzyMatch(term, i.name)).slice(0, MAX_SUGGESTIONS)
    : [];
  const exact = items.find((i) => normalize(i.name) === normalize(term));

  // Clear right away so the next thing can be typed while this one saves;
  // put the text back only if saving fails and nothing new was typed.
  function send(entry: { itemId: string } | { name: string }) {
    const typed = text;
    setText("");
    add.mutate(entry, { onError: () => setText((current) => current || typed) });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!term) return;
    // Typing a pantry item's exact name links it instead of adding free text.
    send(exact ? { itemId: exact.id } : { name: term });
  }

  return (
    <div className="relative">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add something to buy…"
          aria-label="Add to list"
          maxLength={80}
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-base"
        />
        <button
          disabled={!term}
          className="rounded-xl bg-stone-800 px-4 font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {add.error && <p className="mt-1 text-sm text-red-600">{add.error.message}</p>}
      {suggestions.length > 0 && (
        <ul
          className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg"
          aria-label="Pantry suggestions"
        >
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => send({ itemId: item.id })}
                className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-stone-100"
              >
                <span className="flex-1">{item.name}</span>
                <span className="text-xs text-stone-400">from pantry</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
