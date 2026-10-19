import { Camera, CameraPlus, Images, PencilSimple } from "@phosphor-icons/react";

import { BottomSheet } from "./BottomSheet";

interface Props {
  onStockUp: () => void;
  onAddOne: () => void;
  onClose: () => void;
}

/** What the camera button offers. Says up front that the camera will be used. */
export function AddMenu({ onStockUp, onAddOne, onClose }: Props) {
  const option =
    "flex w-full items-start gap-4 rounded-xl border border-stone-200 bg-white p-4 text-left active:bg-stone-50";
  return (
    <BottomSheet title="Add to your pantry" onClose={onClose}>
      <div className="space-y-3 pb-2">
        <button type="button" onClick={onStockUp} className={option}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <CameraPlus size={24} weight="fill" aria-hidden />
          </span>
          <span>
            <span className="block font-semibold">Stock up: many products</span>
            <span className="block text-sm text-stone-600">
              Snap one product after another, then swipe to approve what was read.
            </span>
          </span>
        </button>
        <button type="button" onClick={onAddOne} className={option}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-emerald-700">
            <Camera size={24} weight="fill" aria-hidden />
          </span>
          <span>
            <span className="block font-semibold">Add one product</span>
            <span className="block text-sm text-stone-600">
              Take a photo to fill it in, or type it yourself.
            </span>
          </span>
        </button>
        <p className="flex items-start gap-2 px-1 pt-1 text-sm text-stone-500">
          <Images size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
          Both use your camera, so your phone will ask for access. You can choose photos you
          already have instead.
        </p>
        <p className="flex items-start gap-2 px-1 text-sm text-stone-500">
          <PencilSimple size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden />
          Nothing is saved until you check it.
        </p>
      </div>
    </BottomSheet>
  );
}
