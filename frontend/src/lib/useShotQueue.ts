import { useCallback, useEffect, useRef, useState } from "react";

import { api, type Suggestion } from "../api";
import { PHOTO_SIDE, resizeImage, THUMB_SIDE } from "./images";

export interface Shot {
  id: string;
  /** Local preview, shown right away while the photo uploads. */
  previewUrl: string;
  status: "waiting" | "uploading" | "reading" | "ready" | "failed";
  photoKey: string | null;
  /** Null when the photo couldn't be read; the user fills it in by hand. */
  suggestion: Suggestion | null;
  error: string | null;
}

// Two at a time keeps the phone responsive and stays well within API rate limits.
const CONCURRENCY = 2;

/** Photos taken in a row, each resized, uploaded and read in the background. */
export function useShotQueue() {
  const [shots, setShots] = useState<Shot[]>([]);
  const blobs = useRef(new Map<string, Blob>());
  const started = useRef(new Set<string>());
  // Shots deleted while still uploading: their photo is discarded once the upload lands.
  const removed = useRef(new Set<string>());
  const previews = useRef<string[]>([]);

  const update = (id: string, patch: Partial<Shot>) =>
    setShots((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // Start waiting shots while there's a free slot. `started` guards against starting one
  // twice (effects can run more than once).
  useEffect(() => {
    const inFlight = shots.filter((s) => s.status === "uploading" || s.status === "reading").length;
    const next = shots.filter((s) => s.status === "waiting" && !started.current.has(s.id));
    for (const shot of next.slice(0, Math.max(0, CONCURRENCY - inFlight))) {
      started.current.add(shot.id);
      void process(shot.id);
    }
  }, [shots]);

  async function process(id: string) {
    const blob = blobs.current.get(id);
    if (!blob) return;
    try {
      update(id, { status: "uploading" });
      const [full, thumb] = await Promise.all([resizeImage(blob, PHOTO_SIDE), resizeImage(blob, THUMB_SIDE)]);
      const { photoKey } = await api.uploadPhoto(full, thumb);
      if (removed.current.has(id)) {
        void api.discardPhoto(photoKey).catch(() => {});
        return;
      }
      update(id, { status: "reading", photoKey });
      try {
        update(id, { status: "ready", suggestion: await api.recognize(photoKey) });
      } catch (err) {
        // The photo is saved; only the reading failed (e.g. daily limit). Fill in by hand.
        update(id, { status: "ready", error: (err as Error).message });
      }
    } catch (err) {
      update(id, { status: "failed", error: (err as Error).message });
    } finally {
      blobs.current.delete(id);
    }
  }

  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const add = useCallback((blob: Blob) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUrl = URL.createObjectURL(blob);
    previews.current.push(previewUrl);
    blobs.current.set(id, blob);
    setShots((all) => [...all, { id, previewUrl, status: "waiting", photoKey: null, suggestion: null, error: null }]);
  }, []);

  /** Take a shot out of the batch and delete its uploaded photo. */
  const remove = useCallback((id: string) => {
    removed.current.add(id);
    blobs.current.delete(id);
    setShots((all) => {
      // Read the latest state: the upload may have finished since the user tapped delete.
      const photoKey = all.find((s) => s.id === id)?.photoKey;
      // Best effort (and safe to repeat): an unused photo left behind is harmless.
      if (photoKey) void api.discardPhoto(photoKey).catch(() => {});
      return all.filter((s) => s.id !== id);
    });
  }, []);

  return { shots, add, remove };
}
