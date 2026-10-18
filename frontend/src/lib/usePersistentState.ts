import { useEffect, useState } from "react";

/**
 * useState for a settings object that remembers it in localStorage (best effort).
 * Stored values are merged over `initial`, so newly added fields get their defaults.
 */
export function usePersistentState<T extends object>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : { ...initial, ...JSON.parse(stored) };
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable (private mode, quota); keep the in-memory value.
    }
  }, [key, value]);

  return [value, setValue];
}
