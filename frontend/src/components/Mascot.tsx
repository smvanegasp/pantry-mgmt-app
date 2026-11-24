import { useEffect, useState, type ReactNode } from "react";

/** The onigiri friend from /public/mascots. Decorative unless given alt text. */
export function Mascot({ size = 96, alt = "", float = true, className = "" }: {
  size?: number;
  alt?: string;
  float?: boolean;
  className?: string;
}) {
  // The file in /public/mascots blinks on its own; people who ask for less
  // motion get the still copy instead.
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <img
      src={`/mascots/onigiri${still ? "-still" : ""}.webp`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      draggable={false}
      className={`select-none ${float ? "animate-float" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** A friendly empty state: the onigiri, a title, and what to do next. */
export function EmptyState({ title, children }: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto mt-8 max-w-sm animate-pop text-center text-stone-500">
      <Mascot size={140} float className="mx-auto" />
      <p className="mt-3 text-lg font-bold text-stone-800">{title}</p>
      {children}
    </div>
  );
}

const PETALS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 9) * 0.12,
  size: 10 + ((i * 7) % 12),
  drift: ((i % 5) - 2) * 40,
}));

/** Sakura petals drifting down the screen for a moment. Re-runs whenever `trigger` changes. */
export function PetalShower({ trigger }: { trigger: unknown }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 3200);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!shown) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-petal rounded-[60%_0_60%_0] bg-emerald-300"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
