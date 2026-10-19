import { Basket, GearSix, ShoppingCart, type Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { SESSION_EXPIRED } from "./api";
import { DemoBanner } from "./components/DemoBanner";
import { DesktopQr } from "./components/DesktopQr";
import { useList, useRefreshSession, useSession } from "./hooks";
import { ListPage } from "./pages/ListPage";
import { PantryPage } from "./pages/PantryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";

const TABS: readonly { id: "pantry" | "list" | "settings"; label: string; title: string; icon: Icon }[] = [
  { id: "pantry", label: "Pantry", title: "Pantry", icon: Basket },
  { id: "list", label: "List", title: "Grocery list", icon: ShoppingCart },
  { id: "settings", label: "Settings", title: "Settings", icon: GearSix },
];

type Tab = (typeof TABS)[number]["id"];

const PAGES: Record<Tab, () => React.JSX.Element> = {
  pantry: PantryPage,
  list: ListPage,
  settings: SettingsPage,
};

export function App() {
  return (
    <>
      <Screen />
      <DesktopQr />
    </>
  );
}

function Screen() {
  const session = useSession();
  const refresh = useRefreshSession();

  // A 401 from any request means the session ended (e.g. the demo expired): re-check it.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED, refresh);
    return () => window.removeEventListener(SESSION_EXPIRED, refresh);
  }, [refresh]);

  if (session.isLoading) return null;
  if (session.error) {
    return <p className="p-6 text-center text-red-600">Couldn't reach the app: {session.error.message}</p>;
  }
  if (!session.data?.role) return <WelcomePage />;
  return <MainApp />;
}

function MainApp() {
  const session = useSession().data!;
  const [tab, setTab] = useState<Tab>("pantry");
  const list = useList();
  const toBuy = (list.data ?? []).filter((e) => !e.checked).length;
  const current = TABS.find((t) => t.id === tab)!;
  const Page = PAGES[tab];

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        {/* The tab bar shows where you are; the heading is for screen readers. */}
        <h1 className="sr-only">{current.title}</h1>
        {session.role === "guest" && session.expiresAt && (
          <DemoBanner expiresAt={session.expiresAt} ownerLoginEnabled={session.ownerLoginEnabled} />
        )}
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
              <t.icon size={24} weight="fill" aria-hidden />
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
