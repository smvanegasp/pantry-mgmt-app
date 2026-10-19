import { Basket } from "@phosphor-icons/react";
import { useState } from "react";

import { PasscodeSheet } from "../components/PasscodeSheet";
import { TutorialStrip, type Tutorial } from "../components/TutorialStrip";
import { useSession, useStartGuest } from "../hooks";

const TUTORIALS: Tutorial[] = [
  {
    id: "track",
    title: "Know what's in your pantry",
    text: "Tap how full something is, or how many are left. Search, and add items with an expiration date.",
  },
  {
    id: "stock",
    title: "Stock your pantry in a snap",
    text: "Snap your groceries one after another, then swipe. Things you already have are added to, not doubled.",
  },
  {
    id: "list",
    title: "One-tap grocery list",
    text: "Generate the list from everything running low, then add anything else.",
  },
  {
    id: "shop",
    title: "Check things off in the store",
    text: "Big, easy rows grouped by category. Your progress shows as you go.",
  },
  {
    id: "home",
    title: "Put it all away fast",
    text: "Back home, everything in the cart goes into the pantry in a few taps.",
  },
];

export function WelcomePage() {
  const session = useSession();
  const start = useStartGuest();
  const [loggingIn, setLoggingIn] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <Basket size={28} weight="fill" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold">Pantry</h1>
      </div>
      {/* A personal hello instead of a tagline: who made this and why. */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
          aria-hidden
        >
          SV
        </span>
        <p className="text-sm text-stone-700">
          <b>Hi, I'm Sergio.</b> I built this app for my wife, so we always know what's in our pantry:
          what we bring home from Costco, and what to use before it goes bad.
        </p>
      </div>

      <div className="mt-5">
        <TutorialStrip tutorials={TUTORIALS} />
      </div>

      <div className="mt-auto space-y-3 pt-5">
        <p className="text-center text-sm text-stone-500">
          Try it with a copy of a real pantry. Your changes stay private and reset after 24 hours.
        </p>
        {start.error && <p className="text-center text-sm text-red-600">{start.error.message}</p>}
        <button
          type="button"
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="w-full rounded-xl bg-emerald-600 py-3.5 text-lg font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
        >
          {start.isPending ? "Setting up your demo…" : "Continue"}
        </button>
        {session.data?.ownerLoginEnabled && (
          <button
            type="button"
            onClick={() => setLoggingIn(true)}
            className="w-full rounded-xl border border-stone-300 py-3.5 text-lg font-semibold text-stone-700"
          >
            I'm Sergio's wife
          </button>
        )}
      </div>

      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
    </div>
  );
}
