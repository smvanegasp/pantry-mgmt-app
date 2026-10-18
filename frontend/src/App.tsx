import { useState } from "react";

import { useList } from "./hooks";
import { ListPage } from "./pages/ListPage";
import { PantryPage } from "./pages/PantryPage";
import { SettingsPage } from "./pages/SettingsPage";

const TABS = [
  { id: "pantry", label: "Pantry", title: "Pantry", icon: "🥫" },
  { id: "list", label: "List", title: "Grocery list", icon: "🛒" },
  { id: "settings", label: "Settings", title: "Settings", icon: "⚙️" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const PAGES: Record<Tab, () => React.JSX.Element> = {
  pantry: PantryPage,
  list: ListPage,
  settings: SettingsPage,
};

export function App() {
  const [tab, setTab] = useState<Tab>("pantry");
  const list = useList();
  const toBuy = (list.data ?? []).filter((e) => !e.checked).length;
  const current = TABS.find((t) => t.id === tab)!;
  const Page = PAGES[tab];

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <h1 className="text-2xl font-bold">{current.title}</h1>
      </header>

      <main className="px-4 pt-4">
        <Page />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`relative flex flex-col items-center py-2 text-xs font-medium ${
                tab === t.id ? "text-emerald-700" : "text-stone-500"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {t.icon}
              </span>
              {t.label}
              {t.id === "list" && toBuy > 0 && (
                <span
                  className="absolute top-1 left-1/2 ml-2 min-w-5 rounded-full bg-emerald-600 px-1.5 text-[11px] leading-5 text-white"
                  aria-label={`${toBuy} to buy`}
                >
                  {toBuy}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
