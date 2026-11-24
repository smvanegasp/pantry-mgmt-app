import { ArrowCounterClockwise, ChatCircleText, Check } from "@phosphor-icons/react";
import { useState } from "react";

import type { Feedback } from "../api";
import { useEditFeedback, useFeedback, useMarkFeedback, useSession } from "../hooks";
import { FeedbackSheet } from "./FeedbackSheet";
import { InfoTip } from "./InfoTip";
import { ItemThumb } from "./Photo";

const PAGE = 5;

function sentOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Settings > Feedback (ported from the fit app). Everyone can send a note with screenshots; the
 * owner also gets the inbox of notes sent from this account (visitors' notes go only to Sergio),
 * split into New and Done, a few at a time, each editable and markable done or not done.
 */
export function FeedbackSettings() {
  const session = useSession().data;
  const owner = session?.role === "owner";
  const inbox = useFeedback(owner);
  const mark = useMarkFeedback();
  const [writing, setWriting] = useState(false);
  const [tab, setTab] = useState<Feedback["status"]>("new");
  const [shown, setShown] = useState(PAGE);
  const all = inbox.data ?? [];
  const fresh = all.filter((f) => f.status === "new").length;
  const count = { new: fresh, done: all.length - fresh };
  const listed = all.filter((f) => f.status === tab);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        Feedback
        {owner && fresh > 0 && (
          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">{fresh} new</span>
        )}
        <InfoTip title="Feedback">
          Tell Sergio what's confusing, broken or missing, with screenshots if they help. Notes
          sent from this account are listed here: fix their text, and mark them done once
          they're handled.
        </InfoTip>
      </h2>
      <p className="mb-3 text-sm text-stone-500">
        {owner ? "Ideas and problems for the next round of changes." : "Something confusing, broken or missing? Sergio reads every note."}
      </p>
      <button
        type="button"
        onClick={() => setWriting(true)}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm"
      >
        <ChatCircleText size={18} weight="fill" aria-hidden /> Send feedback
      </button>

      {owner && all.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1" role="tablist" aria-label="Feedback">
          {(["new", "done"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setShown(PAGE);
              }}
              className={`rounded-md py-2 text-sm font-bold ${tab === t ? "bg-white shadow-sm" : "text-stone-500"}`}
            >
              {t === "new" ? "New" : "Done"} <span className="font-medium opacity-70">{count[t]}</span>
            </button>
          ))}
        </div>
      )}
      {owner && all.length > 0 && listed.length === 0 && (
        <p className="py-4 text-center text-sm text-stone-500">
          {tab === "new" ? "Nothing new. All caught up!" : "Nothing marked done yet."}
        </p>
      )}
      {owner && listed.length > 0 && (
        <ul className="mt-2 divide-y divide-dashed divide-stone-200">
          {listed.slice(0, shown).map((f) => (
            <li key={f.id} className="flex items-start gap-2 py-3">
              <div className="min-w-0 flex-1">
                <NoteText feedback={f} />
                {f.photos.length > 0 && (
                  <div className="mt-1.5 flex gap-2">
                    {f.photos.map((key, n) => (
                      <ItemThumb key={key} photoKey={key} alt={`Screenshot ${n + 1}`} size={52} />
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-stone-500">
                  {sentOn(f.createdAt)}
                  {f.page ? ` · ${f.page}` : ""}
                  {f.editedAt ? " · edited" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => mark.mutate({ id: f.id, status: f.status === "new" ? "done" : "new" })}
                disabled={mark.isPending}
                aria-label={f.status === "new" ? "Mark done" : "Mark not done"}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-600"
              >
                {f.status === "new" ? (
                  <>
                    <Check size={12} weight="bold" className="text-matcha-600" aria-hidden /> Done
                  </>
                ) : (
                  <>
                    <ArrowCounterClockwise size={12} weight="bold" aria-hidden /> Not done
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {owner && listed.length > shown && (
        <button
          type="button"
          onClick={() => setShown(shown + PAGE)}
          className="mt-1 w-full py-2 text-sm font-bold text-emerald-700"
        >
          Show {Math.min(PAGE, listed.length - shown)} more
        </button>
      )}
      {writing && <FeedbackSheet onClose={() => setWriting(false)} />}
    </section>
  );
}

/** A note in the inbox; Edit turns it into a text box. */
function NoteText({ feedback }: { feedback: Feedback }) {
  const edit = useEditFeedback();
  const [text, setText] = useState<string | null>(null);
  if (text === null) {
    return (
      <p className="text-sm whitespace-pre-wrap text-stone-800">
        {feedback.text}{" "}
        <button
          type="button"
          onClick={() => setText(feedback.text)}
          className="text-xs font-bold text-emerald-700"
          aria-label="Edit feedback"
        >
          Edit
        </button>
      </p>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim()) await edit.mutateAsync({ id: feedback.id, text: text.trim() });
        setText(null);
      }}
    >
      <textarea
        aria-label="Edit feedback text"
        rows={4}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-sm"
      />
      {edit.error && <p className="text-xs text-red-600">{edit.error.message}</p>}
      <div className="mt-1 flex gap-2">
        <button
          type="submit"
          disabled={edit.isPending || !text.trim()}
          className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={() => setText(null)} className="rounded-full px-3 py-1 text-xs font-bold text-stone-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
