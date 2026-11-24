import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

// Light is the default (Sergio, 2026-11-24). The old key saved "Automatic" whenever Settings was
// opened, so only explicit Light / Dark choices carry over from it.
const KEY = "pantry.appearance";
const OLD_KEY = "pantry.theme";
const THEMES: readonly string[] = ["system", "light", "dark"];
/** Browser bar colors: the cream page, and the night-blue page in dark mode. */
const BAR = { light: "#fff6f2", dark: "#14162a" };
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    if (value !== null && THEMES.includes(value)) return value as Theme;
    const old = localStorage.getItem(OLD_KEY);
    return old === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Mirrors the inline script in index.html, which applies the theme before first paint. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && darkQuery().matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? BAR.dark : BAR.light);
}

/** On "Automatic", follow the phone switching between light and dark while the app is open. */
export function followSystemTheme() {
  darkQuery().addEventListener("change", () => {
    if (storedTheme() === "system") applyTheme("system");
  });
}

/** The chosen appearance, applied to the page and remembered on this device. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Storage unavailable; the choice lasts until the page is closed.
    }
  }, [theme]);

  return [theme, setTheme];
}
