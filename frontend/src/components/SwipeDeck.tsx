import { Check, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  /** The card on top, or null when nothing is left. */
  top: { key: string; content: ReactNode; canAccept: boolean } | null;
  /** The card underneath, shown peeking behind the top one. */
  next: ReactNode | null;
  /** True while the top card is still being read; decisions wait. */
  busy: boolean;
  onDecide: (accept: boolean) => void;
}

const THRESHOLD = 90; // px of horizontal drag that counts as a decision

/** Tinder-style deck: swipe right (or tap check) to accept, left (or tap X) to fix later. */
export function SwipeDeck({ top, next, busy, onDecide }: Props) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Reset the drag when a new card comes to the top.
  useEffect(() => {
    setDx(0);
    setLeaving(null);
  }, [top?.key]);

  function decide(accept: boolean) {
    if (!top || busy || leaving || (accept && !top.canAccept)) return;
    setLeaving(accept ? "right" : "left");
    // Let the card fly off before the next one replaces it.
    setTimeout(() => onDecide(accept), 180);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const offset = leaving === "right" ? 500 : leaving === "left" ? -500 : dx;
  const canDrag = !!top && !busy && !leaving;
  const hint = dx > 30 && top?.canAccept ? "accept" : dx < -30 ? "reject" : null;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {next && (
          <div className="absolute inset-0 scale-95 rounded-2xl border border-stone-200 bg-white opacity-70" aria-hidden>
            {next}
          </div>
        )}
        {top && (
          <div
            role="group"
            aria-label="Review card"
            className={`absolute inset-0 touch-pan-y overflow-hidden rounded-2xl border bg-white shadow-lg ${
              hint === "accept" ? "border-emerald-500" : hint === "reject" ? "border-amber-500" : "border-stone-200"
            }`}
            style={{
              transform: `translateX(${offset}px) rotate(${offset / 25}deg)`,
              transition: start.current ? "none" : "transform 180ms ease-out",
            }}
            onPointerDown={(e) => {
              if (!canDrag) return;
              start.current = { x: e.clientX, y: e.clientY };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!start.current) return;
              setDx(e.clientX - start.current.x);
            }}
            onPointerUp={() => {
              if (!start.current) return;
              start.current = null;
              if (dx > THRESHOLD && top.canAccept) decide(true);
              else if (dx < -THRESHOLD) decide(false);
              else setDx(0);
            }}
            onPointerCancel={() => {
              start.current = null;
              setDx(0);
            }}
          >
            {top.content}
            {hint && (
              <span
                className={`absolute top-4 rounded-lg border-2 px-3 py-1 text-lg font-bold ${
                  hint === "accept"
                    ? "left-4 -rotate-12 border-emerald-600 text-emerald-700"
                    : "right-4 rotate-12 border-amber-600 text-amber-700"
                } bg-white/90`}
              >
                {hint === "accept" ? "LOOKS RIGHT" : "FIX LATER"}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-center gap-10">
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={!canDrag}
          aria-label="Fix later"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-500 bg-white text-amber-600 shadow disabled:opacity-40"
        >
          <X size={30} weight="bold" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={!canDrag || !top?.canAccept}
          aria-label="Looks right"
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-emerald-700 shadow disabled:opacity-40"
        >
          <Check size={30} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}
