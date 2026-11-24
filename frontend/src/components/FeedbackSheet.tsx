import { CheckCircle, ImageSquare, PencilSimple, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { api, photoUrl, type Feedback } from "../api";
import { useEditFeedback, useSendFeedback } from "../hooks";
import { resizeImage, THUMB_SIDE } from "../lib/images";
import { PLACES, lastPlace, type Place } from "../lib/place";
import { BottomSheet } from "./BottomSheet";
import { Mascot } from "./Mascot";

const MAX_SCREENSHOTS = 3;
// Phone screenshots are tall and full of small text: keep more pixels than product photos.
const SCREENSHOT_SIDE = 1600;

/**
 * Leave feedback: which screen it's about (the last tab, preselected), a note and up to three
 * screenshots. Once sent, the text can still be fixed. Ported from the fit app.
 * No autofocus: the screenshot picker leaves the app, and the keyboard popped up on return.
 */
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const send = useSendFeedback();
  const edit = useEditFeedback();
  const [place, setPlace] = useState<Place>(lastPlace());
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [sent, setSent] = useState<Feedback | null>(null);
  const [editing, setEditing] = useState(false);

  if (sent && !editing) {
    return (
      <BottomSheet title="Feedback" onClose={onClose}>
        <div className="py-4 text-center">
          <Mascot size={96} className="mx-auto" />
          <p className="mt-2 flex items-center justify-center gap-1.5 font-bold text-stone-800">
            <CheckCircle size={20} weight="fill" className="text-matcha-600" aria-hidden /> Thanks! Sergio will read it.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-full border border-stone-200 px-4 py-2 font-bold text-stone-700"
            >
              <PencilSimple size={16} weight="fill" aria-hidden /> Edit
            </button>
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 font-bold text-emerald-700">
              Close
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  }

  const busy = send.isPending || edit.isPending;
  const error = send.error ?? edit.error;

  return (
    <BottomSheet title={editing ? "Edit feedback" : "Feedback"} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          if (sent) {
            setSent(await edit.mutateAsync({ id: sent.id, text: text.trim() }));
            setEditing(false);
          } else {
            setSent(await send.mutateAsync({ text: text.trim(), page: place, photos }));
          }
        }}
      >
        {!sent && (
          <>
            <p className="text-sm text-stone-600">
              What would make the app better? Anything that confused you, broke, or is missing.
            </p>
            <p className="mt-3 text-sm font-bold text-stone-700">About</p>
            <div
              className="-mx-5 mt-1 flex gap-2 overflow-x-auto overscroll-none px-5 py-1 [scrollbar-width:none]"
              role="radiogroup"
              aria-label="About which screen"
            >
              {PLACES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={place === p}
                  onClick={() => setPlace(p)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${
                    place === p ? "bg-emerald-600 text-white" : "border border-stone-200 bg-white text-stone-700"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
        <textarea
          aria-label="Your feedback"
          rows={5}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I couldn't find where to change the expiration date"
          className="mt-3 w-full rounded-2xl border border-stone-200 bg-white px-3 py-2"
        />
        {!sent && <Screenshots photos={photos} onChange={setPhotos} />}
        {error && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="mt-3 w-full rounded-full bg-emerald-600 py-3.5 text-lg font-extrabold text-white shadow-lg disabled:opacity-50"
        >
          {busy ? "Sending…" : sent ? "Save" : "Send"}
        </button>
      </form>
    </BottomSheet>
  );
}

/** Up to three screenshots from the library, resized on the device and uploaded right away. */
function Screenshots({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    const chosen = Array.from(files ?? []).slice(0, MAX_SCREENSHOTS - photos.length);
    if (!chosen.length) return;
    setUploading(true);
    setError(null);
    const added: string[] = [];
    try {
      for (const file of chosen) {
        const [full, thumb] = await Promise.all([resizeImage(file, SCREENSHOT_SIDE), resizeImage(file, THUMB_SIDE)]);
        added.push((await api.uploadPhoto(full, thumb)).photoKey);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      onChange([...photos, ...added]);
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((key, n) => (
          <div key={key} className="relative h-16 w-16 overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            <img src={photoUrl(key, "thumb")} alt={`Screenshot ${n + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((p) => p !== key))}
              aria-label={`Remove screenshot ${n + 1}`}
              className="absolute top-0.5 right-0.5 rounded-full bg-stone-900/70 p-0.5 text-white"
            >
              <X size={12} weight="bold" aria-hidden />
            </button>
          </div>
        ))}
        {photos.length < MAX_SCREENSHOTS && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-bold text-stone-700 disabled:opacity-60"
          >
            <ImageSquare size={18} weight="fill" className="text-emerald-600" aria-hidden />
            {uploading ? "Adding…" : photos.length ? "Add another" : "Add screenshots"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => add(e.target.files)}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
