import { Camera, Images } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { Shot } from "../lib/useShotQueue";

interface Props {
  shots: Shot[];
  onShot: (photo: Blob) => void;
}

type CameraState = "starting" | "live" | "unavailable";

/**
 * In-app camera for taking many photos in a row (no system camera screen between shots).
 * Falls back to picking photos when the camera isn't available (desktop, permission denied).
 */
export function CameraCapture({ shots, onShot }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) return;
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        setState("live");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    }
    start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => blob && onShot(blob), "image/jpeg", 0.9);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }

  function pick(files: FileList | null) {
    for (const file of Array.from(files ?? [])) onShot(file);
    if (picker.current) picker.current.value = "";
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-stone-900">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Camera"
          className={`h-full w-full object-cover ${state === "live" ? "" : "hidden"}`}
        />
        {flash && <div className="absolute inset-0 bg-white/70" aria-hidden />}
        {state === "starting" && (
          <p className="absolute inset-0 flex items-center justify-center text-stone-300">Starting camera…</p>
        )}
        {state === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-stone-200">
            <Images size={40} weight="fill" aria-hidden />
            <p>The camera isn't available here. Choose photos of your products instead; you can pick many at once.</p>
          </div>
        )}
      </div>

      {shots.length > 0 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Photos taken">
          {shots.map((s) => (
            <li key={s.id} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-200">
              <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
              {s.status !== "ready" && s.status !== "failed" && (
                <span className="absolute inset-0 bg-white/40" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Choose product photos"
        onChange={(e) => pick(e.target.files)}
      />
      <div className="mt-3 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-stone-700"
          aria-label="Choose photos from library"
        >
          <Images size={24} weight="fill" aria-hidden />
        </button>
        {state === "live" ? (
          <button
            type="button"
            onClick={capture}
            aria-label="Take photo"
            className="h-20 w-20 rounded-full border-4 border-emerald-600 bg-white shadow-lg active:scale-95"
          >
            <Camera size={30} weight="fill" className="mx-auto text-emerald-700" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="rounded-full bg-emerald-600 px-6 py-4 text-lg font-semibold text-white"
          >
            Choose photos
          </button>
        )}
        <span className="w-12 text-center text-sm font-medium text-stone-600" aria-live="polite">
          {shots.length > 0 ? `${shots.length}` : ""}
        </span>
      </div>
    </div>
  );
}
