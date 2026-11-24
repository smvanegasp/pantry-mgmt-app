import { Basket, GearSix, SidebarSimple, ShoppingCart, type Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { SESSION_EXPIRED } from "./api";
import { DemoBanner } from "./components/DemoBanner";
import { DesktopQr } from "./components/DesktopQr";
import { Mascot } from "./components/Mascot";
import { useList, useRefreshSession, useSession } from "./hooks";
import { usePersistentState } from "./lib/usePersistentState";
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

  if (session.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Mascot size={96} alt="Loading" />
      </div>
    );
  }
  if (session.error) {
    return <p className="p-6 text-center text-red-600">Couldn't reach the app: {session.error.message}</p>;
  }
  if (!session.data?.role) return <WelcomePage />;
  return <MainApp />;
}

function MainApp() {
  const session = useSession().data!;
  const [tab, setTab] = useState<Tab>("pantry");
  // Desktop sidebar can be collapsed to icons; remembered on this device.
  const [sidebar, setSidebar] = usePersistentState("pantry.sidebar", { collapsed: false });
  const collapsed = sidebar.collapsed;
  const toggleSidebar = () => setSidebar({ collapsed: !collapsed });
  const list = useList();
  const toBuy = (list.data ?? []).filter((e) => !e.checked).length;
  const current = TABS.find((t) => t.id === tab)!;
  const Page = PAGES[tab];

  const badge = (t: Tab, cls: string) =>
    t === "list" && toBuy > 0 ? (
      <span
        className={`min-w-5 animate-pop rounded-full bg-emerald-600 px-1.5 text-center text-[11px] leading-5 font-bold text-white ${cls}`}
        aria-label={`${toBuy} to buy`}
      >
        {toBuy}
      </span>
    ) : null;

  return (
    <div
      className="min-h-dvh md:flex"
      style={{ "--sidebar": collapsed ? "5rem" : "16rem" } as React.CSSProperties}
    >
      {/* Desktop: a soft sidebar with the mascot and tabs. */}
      <aside className="sticky top-0 hidden h-dvh w-(--sidebar) shrink-0 flex-col border-r border-stone-200/70 bg-white/70 px-3 py-6 backdrop-blur transition-[width] duration-200 md:flex">
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : "px-1"}`}>
          <Mascot size={collapsed ? 44 : 52} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-2xl leading-none font-extrabold text-stone-900">Pantry</p>
              <p className="text-xs font-bold text-emerald-600">Our cozy kitchen</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Open menu" : "Close menu"}
            aria-expanded={!collapsed}
            title={collapsed ? "Open menu" : "Close menu"}
            className="shrink-0 rounded-xl p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
          >
            <SidebarSimple size={22} weight="bold" aria-hidden />
          </button>
        </div>
        <nav className="mt-8 space-y-1.5" aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              title={collapsed ? t.label : undefined}
              aria-label={collapsed ? t.label : undefined}
              className={`relative flex w-full items-center gap-3 rounded-2xl py-3 text-left font-bold ${collapsed ? "justify-center px-0" : "px-4"} ${
                tab === t.id
                  ? "bg-emerald-100 text-emerald-800 shadow-sm"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <t.icon size={24} weight="fill" aria-hidden />
              {!collapsed && <span className="flex-1">{t.label}</span>}
              {badge(t.id, collapsed ? "absolute top-1 right-2" : "")}
            </button>
          ))}
        </nav>
      </aside>

      <div className="mx-auto w-full max-w-lg min-w-0 flex-1 md:max-w-6xl md:px-6">
        <main className="px-4 pt-[max(1rem,env(safe-area-inset-top))] md:pt-8 md:pb-10">
          <h1 className="sr-only md:not-sr-only md:mb-6 md:flex md:items-baseline md:gap-3 md:text-3xl md:font-extrabold md:text-stone-900">
            {current.title}
          </h1>
          {session.role === "guest" && session.expiresAt && (
            <DemoBanner expiresAt={session.expiresAt} ownerLoginEnabled={session.ownerLoginEnabled} />
          )}
          <Page />
        </main>
      </div>

      {/* Phone: a floating, rounded tab bar. */}
      <nav
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-full border border-stone-200/70 bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden"
        aria-label="Main"
      >
        <div className="grid grid-cols-3 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`relative flex flex-col items-center rounded-full py-1.5 text-xs font-bold ${
                tab === t.id ? "bg-emerald-100 text-emerald-700" : "text-stone-500"
              }`}
            >
              <t.icon size={24} weight="fill" aria-hidden />
              {t.label}
              {badge(t.id, "absolute top-0 left-1/2 ml-2")}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
