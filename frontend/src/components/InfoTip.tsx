import { Info } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface Props {
  /** Short name of the feature, used as the popover title and the button label. */
  title: string;
  children: ReactNode;
  /** Which edge the popover lines up with; use "right" near the right side of the screen. */
  align?: "left" | "right";
}

/** A small (i) button that explains a feature in a popover. Tap again or tap outside to close. */
export function InfoTip({ title, children, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={id}
        className="-m-1.5 rounded-full p-1.5 text-stone-400 hover:text-emerald-700 aria-expanded:text-emerald-700"
      >
        <Info size={18} weight="fill" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-50 mt-2 block w-64 rounded-xl bg-stone-900 p-3 text-left text-sm font-normal tracking-normal text-stone-100 normal-case shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <span className="mb-1 block font-semibold text-white">{title}</span>
          {children}
        </span>
      )}
    </span>
  );
}
