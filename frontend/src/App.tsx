import { useState } from "react";

import { PantryPage } from "./pages/PantryPage";
import { SettingsPage } from "./pages/SettingsPage";

const TABS = [
  { id: "pantry", label: "Pantry", icon: "🥫" },
  { id: "settings", label: "Settings", icon: "⚙️" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function App() {
  const [tab, setTab] = useState<Tab>("pantry");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <h1 className="text-2xl font-bold">{current.label}</h1>
      </header>

      <main className="px-4 pt-4">{tab === "pantry" ? <PantryPage /> : <SettingsPage />}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex flex-col items-center py-2 text-xs font-medium ${
                tab === t.id ? "text-emerald-700" : "text-stone-500"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
