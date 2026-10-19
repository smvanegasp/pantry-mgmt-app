import { Camera, Image, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, photoUrl } from "../api";
import { PHOTO_SIDE, resizeImage, THUMB_SIDE } from "../lib/images";

/** Full-screen view of an item's photo; tap anywhere or press Escape to close. */
export function PhotoViewer({ photoKey, alt, onClose }: { photoKey: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <img src={photoUrl(photoKey)} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 rounded-full bg-white/15 p-2 text-white"
      >
        <X size={22} weight="bold" aria-hidden />
      </button>
    </div>,
    document.body,
  );
}

/** Small square photo; tapping it opens the full photo. Renders nothing if it fails to load. */
export function ItemThumb({ photoKey, alt, size = 48 }: { photoKey: string; alt: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`View photo of ${alt}`}
        className="shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
        style={{ width: size, height: size }}
      >
        <img
          src={photoUrl(photoKey, "thumb")}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      </button>
      {open && <PhotoViewer photoKey={photoKey} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Photo picker for the item form: take or choose a photo, resized on the device and uploaded. */
export function PhotoField({
  photoKey,
  name,
  onChange,
}: {
  photoKey: string | null;
  name: string;
  onChange: (photoKey: string | null) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const [full, thumb] = await Promise.all([resizeImage(file, PHOTO_SIDE), resizeImage(file, THUMB_SIDE)]);
      const { photoKey: key } = await api.uploadPhoto(full, thumb);
      onChange(key);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      for (const el of [camera.current, library.current]) if (el) el.value = "";
    }
  }

  return (
    <div>
      {/* capture="environment" opens the rear camera directly instead of the system menu. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Take item photo"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Choose item photo"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <div className="flex items-center gap-3">
        {photoKey ? (
          <ItemThumb photoKey={photoKey} alt={name || "item"} size={72} />
        ) : (
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-400">
            <Image size={28} weight="fill" aria-hidden />
          </span>
        )}
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => camera.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            <Camera size={16} weight="fill" aria-hidden />
            {uploading ? "Uploading…" : photoKey ? "Retake photo" : "Take photo"}
          </button>
          {!uploading && (
            <div className="flex gap-3 px-1 text-sm text-stone-500">
              <button type="button" onClick={() => library.current?.click()}>
                Choose from library
              </button>
              {photoKey && (
                <button type="button" onClick={() => onChange(null)}>
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
