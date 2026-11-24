import { ArrowCounterClockwise, ArrowUpRight, Flask, SignIn } from "@phosphor-icons/react";
import { useState } from "react";

import { useResetGuest } from "../hooks";
import { SITE_URL } from "../lib/site";
import { InfoTip } from "./InfoTip";
import { PasscodeSheet } from "./PasscodeSheet";

function timeLeft(expiresAt: number): string {
  const hours = Math.max(0, Math.round((expiresAt * 1000 - Date.now()) / 3_600_000));
  return hours >= 1 ? `${hours}h` : "less than an hour";
}

/** Shown to guests: they're in a private sandbox, with ways to reset or log in. */
export function DemoBanner({ expiresAt, ownerLoginEnabled }: { expiresAt: number; ownerLoginEnabled: boolean }) {
  const reset = useResetGuest();
  const [loggingIn, setLoggingIn] = useState(false);

  function confirmReset() {
    if (confirm("Start the demo over? Your changes will be replaced with a fresh copy.")) reset.mutate();
  }

  return (
    <div
      data-demo-banner
      className="mb-4 flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900"
    >
      <Flask size={18} weight="fill" className="shrink-0 text-sky-700" aria-hidden />
      <span className="flex-1">
        Demo · resets in {timeLeft(expiresAt)}{" "}
        <InfoTip title="Demo mode">
          You're using a private copy of a real pantry. Change anything you like: nobody else
          sees it, and it's deleted after 24 hours. Reset starts over from a fresh copy.
        </InfoTip>
      </span>
      <button
        type="button"
        onClick={confirmReset}
        disabled={reset.isPending}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-sky-800 active:bg-sky-100"
      >
        <ArrowCounterClockwise size={14} weight="bold" aria-hidden /> Reset
      </button>
      {/* Back to Sergio's projects page, in a new tab (as in the fit app). */}
      <a
        href={SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="sergiovanegas.com/projects"
        aria-label="sergiovanegas.com projects (opens in a new tab)"
        className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 font-medium text-sky-800 active:bg-sky-100"
      >
        Site <ArrowUpRight size={12} weight="bold" aria-hidden />
      </a>
      {ownerLoginEnabled && (
        <button
          type="button"
          onClick={() => setLoggingIn(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 font-medium text-sky-800 active:bg-sky-100"
        >
          <SignIn size={14} weight="bold" aria-hidden /> Log in
        </button>
      )}
      {loggingIn && <PasscodeSheet onClose={() => setLoggingIn(false)} />}
    </div>
  );
}
