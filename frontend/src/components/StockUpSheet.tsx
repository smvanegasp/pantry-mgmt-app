import { ArrowCounterClockwise, CheckCircle, Clock, PencilSimple, Sparkle, Trash, X } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, type Category, type Item, type ItemInput, type Package } from "../api";
import { useCategories, useItems } from "../hooks";
import { formatExpiry } from "../lib/dates";
import { draftItem, findCategory, findExisting, packageFrom } from "../lib/stockup";
import { useShotQueue, type Shot } from "../lib/useShotQueue";
import { BottomSheet } from "./BottomSheet";
import { CameraCapture } from "./CameraCapture";
import { InfoTip } from "./InfoTip";
import { ItemForm } from "./ItemForm";
import { SwipeDeck } from "./SwipeDeck";

type Step = "capture" | "review" | "fix" | "done";

/** What accepting a card did, so it can be undone. */
type Outcome =
  | { kind: "created"; itemId: string }
  | { kind: "packaged"; itemId: string; previous: Package[] }
  | { kind: "rejected" };

const usable = (s: Shot) => s.status === "ready" && !!s.suggestion?.isProduct && !!s.suggestion.name;

function CardContent({ shot, existing, categories }: { shot: Shot; existing?: Item; categories: Category[] }) {
  const s = shot.suggestion;
  const category = s?.categoryId
    ? categories.find((c) => c.id === s.categoryId)?.name
    : s?.newCategoryName
      ? `${s.newCategoryName} (new)`
      : null;
  return (
    <div className="flex h-full flex-col">
      <img src={shot.previewUrl} alt="" className="min-h-0 w-full flex-1 bg-stone-100 object-cover" draggable={false} />
      <div className="space-y-1 p-4">
        {shot.status !== "ready" && shot.status !== "failed" ? (
          <p className="flex items-center gap-2 font-medium text-emerald-800">
            <Sparkle size={18} weight="fill" className="animate-pulse" aria-hidden /> Reading the label…
          </p>
        ) : usable(shot) && s ? (
          <>
            <p className="text-xl font-semibold">{s.name}</p>
            <p className="text-sm text-stone-600">
              {[category, s.mode === "count" ? `${s.count ?? 1} counted` : "Full", s.expiresOn && formatExpiry(s.expiresOn)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {existing && (
              <p className="text-sm font-medium text-sky-700">Adds to “{existing.name}” in your pantry</p>
            )}
          </>
        ) : (
          <p className="text-stone-700">
            {shot.status === "failed"
              ? `Upload failed: ${shot.error}`
              : s && !s.isProduct
                ? "That doesn't look like a pantry product."
                : `Couldn't read this one${shot.error ? ` (${shot.error})` : ""}.`}{" "}
            Swipe left to fix it by hand.
          </p>
        )}
      </div>
    </div>
  );
}

/** Full-screen "Stock your pantry": snap many photos, swipe to accept, fix the rest. */
export function StockUpSheet({ onClose }: { onClose: () => void }) {
  const { shots, add, remove } = useShotQueue();
  const items = useItems().data ?? [];
  const categories = useCategories().data ?? [];
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("capture");
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [fixed, setFixed] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [fixing, setFixing] = useState<Shot | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Categories created during this session, so two photos don't create the same one twice.
  const createdCategories = useRef(new Map<string, string>());

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      refresh();
    };
  }, []);

  async function categoryIdFor(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    const known = createdCategories.current.get(key) ?? findCategory(categories, name)?.id;
    if (known) return known;
    const created = await api.createCategory(name.trim());
    createdCategories.current.set(key, created.id);
    return created.id;
  }

  async function accept(shot: Shot): Promise<Outcome> {
    const s = shot.suggestion!;
    const existing = findExisting(items, s.name);
    if (existing) {
      await api.updateItem(existing.id, {
        packages: [...existing.packages, packageFrom(s)],
        ...(existing.photoKey ? {} : { photoKey: shot.photoKey }),
      });
      return { kind: "packaged", itemId: existing.id, previous: existing.packages };
    }
    const categoryId = s.categoryId ?? (s.newCategoryName ? await categoryIdFor(s.newCategoryName) : null);
    const created = await api.createItem({ ...draftItem(s, shot.photoKey, categories), categoryId });
    return { kind: "created", itemId: created.id };
  }

  async function decide(acceptCard: boolean) {
    const shot = shots[index];
    setError(null);
    try {
      setSaving(true);
      const outcome = acceptCard && usable(shot) ? await accept(shot) : ({ kind: "rejected" } as Outcome);
      setOutcomes((o) => ({ ...o, [shot.id]: outcome }));
      if (outcome.kind !== "rejected") refresh();
      setIndex((i) => i + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    const shot = shots[index - 1];
    const outcome = shot && outcomes[shot.id];
    if (!outcome) return;
    setError(null);
    try {
      if (outcome.kind === "created") await api.deleteItem(outcome.itemId);
      if (outcome.kind === "packaged") await api.updateItem(outcome.itemId, { packages: outcome.previous });
      setOutcomes(({ [shot.id]: _, ...rest }) => rest);
      setIndex((i) => i - 1);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveFixed(shot: Shot, input: ItemInput) {
    setSaving(true);
    try {
      await api.createItem(input);
      setFixed((f) => new Set(f).add(shot.id));
      setFixing(null);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const reviewed = Object.keys(outcomes).length;
  const toFix = shots.filter((s) => outcomes[s.id]?.kind === "rejected" && !fixed.has(s.id) && !skipped.has(s.id));
  const added = shots.filter((s) => outcomes[s.id] && outcomes[s.id].kind !== "rejected").length + fixed.size;

  // Move on once every photo has been reviewed.
  useEffect(() => {
    // Every photo was discarded: back to the camera.
    if (step === "review" && shots.length === 0) setStep("capture");
    if (step === "review" && shots.length > 0 && index >= shots.length) setStep(toFix.length ? "fix" : "done");
    if (step === "fix" && toFix.length === 0) setStep("done");
  }, [step, index, shots.length, toFix.length]);

  const top = shots[index];
  const title = { capture: "Stock your pantry", review: "Review", fix: "Fix these", done: "All done" }[step];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 flex flex-col bg-stone-50">
      <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-semibold">
            {title}
            {step === "review" && (
              <span className="ml-2 text-sm font-normal text-stone-500">
                {Math.min(index + 1, shots.length)} of {shots.length}
              </span>
            )}
          </h2>
          {step === "capture" && (
            <InfoTip title="Stock your pantry">
              Take a photo of each product, one after another. They're read in the background. Then
              swipe right on the ones that look right (they're added right away) and left on the
              ones to fix by hand.
            </InfoTip>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X size={20} weight="bold" aria-hidden />
          </button>
        </div>

        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {step === "capture" && (
          <>
            <div className="min-h-0 flex-1">
              <CameraCapture shots={shots} onShot={add} onRemove={remove} />
            </div>
            <button
              type="button"
              onClick={() => setStep("review")}
              disabled={shots.length === 0}
              className="mt-4 w-full rounded-xl bg-stone-900 py-3.5 text-lg font-semibold text-white disabled:opacity-40"
            >
              {shots.length === 0 ? "Take a photo to start" : `Review ${shots.length} photo${shots.length === 1 ? "" : "s"}`}
            </button>
          </>
        )}

        {step === "review" && top && (
          <>
            <div className="min-h-0 flex-1">
              <SwipeDeck
                top={{
                  key: top.id,
                  canAccept: usable(top),
                  content: <CardContent shot={top} existing={top.suggestion ? findExisting(items, top.suggestion.name) : undefined} categories={categories} />,
                }}
                next={shots[index + 1] ? <CardContent shot={shots[index + 1]} categories={categories} /> : null}
                busy={saving || (top.status !== "ready" && top.status !== "failed")}
                onDecide={decide}
              />
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <button
                type="button"
                onClick={undo}
                disabled={index === 0 || saving}
                className="inline-flex items-center gap-1 px-2 py-2 text-stone-600 disabled:opacity-40"
              >
                <ArrowCounterClockwise size={16} weight="bold" aria-hidden /> Undo
              </button>
              <button
                type="button"
                onClick={() => remove(top.id)}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2 py-2 text-red-600 disabled:opacity-40"
              >
                <Trash size={16} weight="fill" aria-hidden /> Discard photo
              </button>
              <button type="button" onClick={() => setStep("capture")} className="px-2 py-2 text-stone-600">
                Take more photos
              </button>
            </div>
          </>
        )}

        {step === "fix" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="mb-3 text-sm text-stone-600">Tap one to fill it in. You can also skip any you don't want to add.</p>
            <ul className="space-y-2">
              {toFix.map((shot) => (
                <li key={shot.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
                  <img src={shot.previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <button type="button" onClick={() => setFixing(shot)} className="flex flex-1 items-center gap-2 text-left">
                    <span className="flex-1 font-medium">{shot.suggestion?.name || "Unnamed product"}</span>
                    <PencilSimple size={18} weight="fill" className="text-stone-400" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkipped((s) => new Set(s).add(shot.id));
                      if (shot.photoKey) void api.discardPhoto(shot.photoKey).catch(() => {});
                    }}
                    className="px-2 py-2 text-sm text-stone-500"
                  >
                    Skip
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <CheckCircle size={56} weight="fill" className="text-emerald-600" aria-hidden />
            <p className="mt-3 text-xl font-semibold">
              {added} item{added === 1 ? "" : "s"} added to your pantry
            </p>
            {reviewed > added && (
              <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
                <Clock size={14} weight="fill" aria-hidden /> {reviewed - added} skipped
              </p>
            )}
            <button type="button" onClick={onClose} className="mt-6 w-full rounded-xl bg-emerald-600 py-3.5 text-lg font-semibold text-white">
              Done
            </button>
          </div>
        )}
      </div>

      {fixing && (
        <BottomSheet title="Fix item" onClose={() => setFixing(null)}>
          <ItemForm
            initial={draftItem(fixing.suggestion, fixing.photoKey, categories)}
            categories={categories}
            submitLabel="Add to pantry"
            submitting={saving}
            error={error ?? undefined}
            onSubmit={(input) => saveFixed(fixing, input)}
          />
        </BottomSheet>
      )}
    </div>,
    document.body,
  );
}
