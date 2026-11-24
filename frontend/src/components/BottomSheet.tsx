import { X } from "@phosphor-icons/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useScrollLock } from "../lib/scrollLock";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A sheet from the bottom (a dialog on wider screens). The title stays put and only the content
 * scrolls, without the iPhone's rubber band; the page behind stays where it was.
 */
export function BottomSheet({ title, onClose, children }: Props) {
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Rendered at the end of <body> so sheets never inherit styles from where they're opened.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col animate-pop rounded-t-[2rem] border border-stone-200/70 bg-white shadow-xl sm:max-w-xl sm:rounded-[2rem]"
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-stone-200 sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between border-b-2 border-dashed border-stone-200 px-5 py-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <span className="h-3 w-3 rounded-full bg-emerald-400" aria-hidden />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full bg-stone-100 p-2 text-stone-500 hover:bg-emerald-100 hover:text-emerald-700"
            aria-label="Close"
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
