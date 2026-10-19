import { Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { Package } from "../api";

interface Props {
  packages: Package[];
  renderPackage: (pkg: Package) => ReactNode;
  onRemove: (id: string) => void;
  /** Package to slide to (e.g. one that was just added). */
  focusId?: string | null;
  /** What one card is called: "Package" for how-full items, "Expiration date" for how-many. */
  label?: string;
}

/**
 * Swipe between an item's packages one card at a time, so several packages don't make the
 * form long. The next card peeks in to show there's more; adding a package slides to it.
 */
export function PackageCarousel({ packages, renderPackage, onRemove, focusId, label = "Package" }: Props) {
  const lower = label.toLowerCase();
  const strip = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = (index: number, behavior: ScrollBehavior = "smooth") => {
    const card = strip.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior, inline: "center", block: "nearest" });
  };

  useEffect(() => {
    const index = packages.findIndex((p) => p.id === focusId);
    if (index >= 0) scrollTo(index);
    // Only when the focus changes, not on every edit.
  }, [focusId]);

  // Stay in range when a package is removed.
  useEffect(() => {
    if (active >= packages.length) setActive(packages.length - 1);
  }, [packages.length, active]);

  function onScroll() {
    const el = strip.current;
    const first = el?.children[0] as HTMLElement | undefined;
    if (!el || !first) return;
    const step = first.offsetWidth + 12; // card width + gap-3
    setActive(Math.min(packages.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-stone-600" aria-live="polite">
        {label} {active + 1} of {packages.length}
        <span className="font-normal text-stone-400"> · swipe to see the others</span>
      </p>
      <ul
        ref={strip}
        onScroll={onScroll}
        aria-label={`${label}s`}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {packages.map((pkg, i) => (
          <li
            key={pkg.id}
            aria-label={`${label} ${i + 1}`}
            className="w-[calc(100%-1.5rem)] shrink-0 snap-center rounded-xl border border-stone-200 bg-white p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700">
                {label} {i + 1}
              </h3>
              <button
                type="button"
                onClick={() => onRemove(pkg.id)}
                className="-my-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600"
                aria-label={`Remove ${lower} ${i + 1}`}
              >
                <Trash size={16} weight="fill" aria-hidden /> Remove
              </button>
            </div>
            {renderPackage(pkg)}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-center gap-2">
        {packages.map((pkg, i) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => scrollTo(i)}
            aria-label={`Show ${lower} ${i + 1}`}
            aria-current={i === active}
            className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-emerald-600" : "w-2 bg-stone-300"}`}
          />
        ))}
      </div>
    </div>
  );
}
