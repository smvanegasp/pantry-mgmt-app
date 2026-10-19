import { DeviceMobile, QrCode as QrIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { usePersistentState } from "../lib/usePersistentState";
import { useMediaQuery } from "../lib/useMediaQuery";
import { BottomSheet } from "./BottomSheet";
import { QrCode } from "./QrCode";

/** A wide screen with a mouse: a computer. Phones and tablets never match. */
const DESKTOP = "(min-width: 900px) and (hover: hover) and (pointer: fine)";

/**
 * The app is made for phones (camera, one hand in the store). On a computer, offer a QR code
 * to open it on the phone instead: shown once on arrival, then from a button in the corner.
 */
export function DesktopQr() {
  const desktop = useMediaQuery(DESKTOP);
  const [seen, setSeen] = usePersistentState("pantry.phoneQr", { closed: false });
  const [open, setOpen] = useState(!seen.closed);
  if (!desktop) return null;

  // Whatever address is open (the live site, later the custom domain, or an ngrok tunnel).
  const url = `${window.location.origin}/`;
  const close = () => {
    setOpen(false);
    setSeen({ closed: true });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-20 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
      >
        <QrIcon size={18} weight="fill" className="text-emerald-600" aria-hidden />
        Open on your phone
      </button>
    );
  }

  return (
    <BottomSheet title="Made for your phone" onClose={close}>
      <div className="text-center">
        <p className="text-stone-700">
          Pantry is built for your phone, so you can snap products with the camera and check things
          off in the store. Scan this with your phone's camera to try it there.
        </p>
        <QrCode text={url} className="mx-auto my-5 h-56 w-56 rounded-xl border border-stone-200" />
        <p className="flex items-center justify-center gap-1.5 text-sm text-stone-500">
          <DeviceMobile size={16} weight="fill" aria-hidden /> {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </p>
        <button
          type="button"
          onClick={close}
          className="mt-5 w-full rounded-xl border border-stone-200 py-3 font-medium text-stone-700"
        >
          Continue on this computer
        </button>
      </div>
    </BottomSheet>
  );
}
