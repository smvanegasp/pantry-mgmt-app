import { Flower } from "@phosphor-icons/react";
import { useState } from "react";

import { Mascot } from "../components/Mascot";
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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:grid md:max-w-6xl md:grid-cols-2 md:items-stretch md:gap-x-8 md:gap-y-8 md:px-10 md:py-14">
      <div className="md:contents">
        {/* Hero: the onigiri friend says hi. */}
        <div className="relative flex items-center gap-4 md:col-span-2 md:justify-center">
          <div className="relative">
            <span className="absolute inset-2 rounded-full bg-emerald-200 blur-xl" aria-hidden />
            <Mascot size={96} className="relative md:h-36! md:w-36! lg:h-44! lg:w-44!" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-stone-900 md:text-5xl lg:text-6xl">Pantry</h1>
            <p className="text-sm font-medium text-stone-500 lg:text-base">Your cozy kitchen helper</p>
          </div>
        </div>

        {/* A personal hello instead of a tagline: who made this and why. */}
        <div className="mt-5 flex items-start gap-3 rounded-[1.75rem] border-2 border-dashed border-emerald-200 bg-white p-4 shadow-sm md:mt-0 md:items-center md:gap-5 md:rounded-[2.5rem] md:p-8">
          <img
            src="/sergio.jpg"
            alt="Sergio"
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full md:h-20 md:w-20 object-cover ring-4 ring-emerald-100"
          />
          <p className="text-sm text-stone-700 md:text-base">
            <b>Hi, I'm Sergio!</b> I built this for my wife and me, so the good food we bring home
            from Costco gets eaten, not thrown away. A little tech, a lot less waste.
          </p>
        </div>

      </div>

      <section className="mt-5 md:order-last md:col-span-2 md:mt-0 md:rounded-[2.5rem] md:border md:border-stone-200/70 md:bg-white md:p-10 md:shadow-sm">
        <h2 className="mb-8 hidden text-center text-2xl font-extrabold text-stone-900 md:block">How it works</h2>
        <TutorialStrip tutorials={TUTORIALS} />
      </section>

      <div className="flex flex-1 flex-col md:justify-center md:rounded-[2.5rem] md:border md:border-stone-200/70 md:bg-white md:p-8 md:shadow-sm">

        <div className="mt-auto space-y-3 pt-5 md:mt-0 md:pt-0">
          <p className="text-center text-sm text-stone-500">
            Try it with a copy of a real pantry. Your changes stay private and reset after 24 hours.
          </p>
          {start.error && <p className="text-center text-sm text-red-600">{start.error.message}</p>}
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="w-full rounded-full bg-emerald-600 py-4 text-lg font-extrabold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-60"
          >
            {start.isPending ? "Setting up your demo…" : "Continue"}
          </button>
          {session.data?.ownerLoginEnabled && (
            <button
              type="button"
              onClick={() => setLoggingIn(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-emerald-200 bg-white py-3.5 text-lg font-bold text-emerald-700 hover:bg-emerald-50"
            >
              I'm Sergio's wife
              <Flower size={20} weight="fill" className="text-emerald-500" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
    </div>
  );
}
