import { Basket, Bell, House, ShoppingCart, type Icon } from "@phosphor-icons/react";
import { useState } from "react";

import { PasscodeSheet } from "../components/PasscodeSheet";
import { useSession, useStartGuest } from "../hooks";

const FEATURES: { icon: Icon; title: string; text: string }[] = [
  {
    icon: Basket,
    title: "Know what's in your pantry",
    text: "Log items with how full they are or how many are left, plus expiration dates.",
  },
  {
    icon: Bell,
    title: "See what's running low",
    text: "Items below their threshold, or about to expire, are flagged for you.",
  },
  {
    icon: ShoppingCart,
    title: "One-tap grocery list",
    text: "Generate the list from what's low and check things off in the store.",
  },
  {
    icon: House,
    title: "Put it all away fast",
    text: "Back home, everything in the cart goes into the pantry in a few taps.",
  },
];

export function WelcomePage() {
  const session = useSession();
  const start = useStartGuest();
  const [loggingIn, setLoggingIn] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <Basket size={28} weight="fill" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold">Pantry</h1>
      </div>
      <p className="mt-4 text-lg text-stone-600">
        A simple way to keep track of your pantry and never forget what to buy.
      </p>

      <ul className="mt-8 space-y-5">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <f.icon size={22} weight="fill" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{f.title}</span>
              <span className="text-sm text-stone-600">{f.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-3 pt-10">
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
