"use client";

import type { AuthUser } from "@torpreca/shared";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  ScrollText,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout as logoutRequest, verifySession } from "@/lib/api/auth-client";
import { encodeReturnTo } from "@/lib/auth/return-to";
import { announceSignedOut, onSignedOutElsewhere } from "@/lib/auth/session-broadcast";
import { clearCachedAuthUser, readCachedAuthUser, writeCachedAuthUser } from "@/lib/auth/session-cache";
import { useInactivityTimeout } from "@/lib/hooks/use-inactivity-timeout";
import { useTranslation } from "@/lib/i18n/use-translation";
import { readStoredSidebarCollapsed, writeStoredSidebarCollapsed } from "@/lib/preferences/sidebar";
import { AuthUserProvider } from "./auth-context";
import { SessionExpiredDialog } from "./session-expired-dialog";

// TOR-123 card: 15-30 min suggested — picked the middle of that range.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

// Mirrors the sidebar nav in context/dashboard/assets/TorprecaDesignV2.pdf.
// "Conductores" is the mockup's label for people-management, which today
// lives at /users (TOR-42 — covers drivers, supervisors and admins, not only
// drivers). Reportes has no screen yet (TOR-24) — shown disabled so the
// shell matches the approved design without linking to a page that doesn't
// exist. "Rutas" (TOR-30) got its screen at /rutas. "Panel Principal"
// (TOR-12) got its screen at "/". "Vehículos" (TOR-44) isn't in that mockup
// at all — added because the screen needs to be reachable from somewhere;
// slotted next to Rutas since both feed the same route-assignment workflow.
// `superAdminOnly` items are filtered out of the render entirely for anyone
// else (CLAUDE.md: "Pantalla de logs solo renderiza si rol === 'super_admin'")
// — not just disabled-looking, not in the DOM at all.
type NavKey =
  | "panelPrincipal"
  | "conductores"
  | "rutas"
  | "vehiculos"
  | "reportes"
  | "logsDelSistema"
  | "ajustes";

const NAV_ITEMS: {
  key: NavKey;
  href: string;
  enabled: boolean;
  icon: typeof Users;
  superAdminOnly?: boolean;
}[] = [
  { key: "panelPrincipal", href: "/", enabled: true, icon: LayoutDashboard },
  { key: "conductores", href: "/users", enabled: true, icon: Users },
  { key: "rutas", href: "/rutas", enabled: true, icon: Route },
  { key: "vehiculos", href: "/vehiculos", enabled: true, icon: Truck },
  { key: "reportes", href: "/reportes", enabled: false, icon: FileText },
  { key: "logsDelSistema", href: "/logs", enabled: true, icon: ScrollText, superAdminOnly: true },
  { key: "ajustes", href: "/ajustes", enabled: true, icon: Settings },
];

// The sidebar always uses the fixed brand blue (bg-brand doesn't swap with
// the theme, same identity color as the login panel) — unlike the rest of
// the shell, which follows the light/dark M3 tokens. See the mockup in
// context/dashboard/assets/TorprecaDesignV2.pdf: the sidebar looks identical
// in both screenshots, only the main content area's tokens flip.
function Sidebar({
  authUser,
  onLogout,
  collapsed,
  onToggleCollapsed,
}: {
  authUser: AuthUser;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const roleLabel = t.sidebar.roles[authUser.role];

  return (
    <aside
      className={`flex flex-col justify-between overflow-hidden bg-brand transition-[width] duration-200 ${collapsed ? "w-16" : "w-60"}`}
    >
      <div>
        <div
          className={`flex items-center py-5 ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}
        >
          {!collapsed && (
            <div>
              <p className="text-lg font-semibold tracking-tight text-white">TORPRECA</p>
              <p className="text-xs text-white/60">{t.sidebar.adminPanel}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t.sidebar.expandMenu : t.sidebar.collapseMenu}
            title={collapsed ? t.sidebar.expandMenu : t.sidebar.collapseMenu}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 cursor-pointer"
          >
            <Menu size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.filter(
            (item) => !item.superAdminOnly || authUser.role === "super_admin",
          ).map((item) => {
            const active = item.enabled && pathname === item.href;
            const Icon = item.icon;
            const label = t.sidebar[item.key];
            if (!item.enabled) {
              return (
                <span
                  key={item.href}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/40 ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon size={16} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{label}</span>
                      <span className="text-[10px] uppercase tracking-wide">{t.sidebar.comingSoon}</span>
                    </>
                  )}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : ""} ${
                  // text-brand (dark, fixed) instead of white: --secondary is
                  // theme-tonal (a light peach in dark mode, see globals.css)
                  // — white text on it failed contrast, especially in dark
                  // mode where it was nearly unreadable.
                  active ? "bg-secondary text-brand" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className={`flex border-t border-white/10 py-4 ${collapsed ? "flex-col items-center gap-2 px-2" : "items-center gap-3 px-5"}`}
      >
        <span
          title={collapsed ? roleLabel : undefined}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-medium text-brand"
        >
          {roleLabel[0]}
        </span>
        {collapsed ? (
          <button
            type="button"
            onClick={onLogout}
            title={t.sidebar.logout}
            aria-label={t.sidebar.logout}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        ) : (
          <div className="flex flex-1 flex-col">
            <span className="text-sm text-white">{roleLabel}</span>
            <button
              type="button"
              onClick={onLogout}
              className="text-left text-xs font-medium text-white/70 hover:text-white hover:underline cursor-pointer"
            >
              {t.sidebar.logout}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Lazy initializer (not a plain `useState(false)` + effect): this layout
  // never renders real content on its first pass anyway (see `if (checking
  // || !authUser) return null` below) — checking/authUser are only ever
  // resolved client-side — so there's no server-rendered sidebar output to
  // mismatch against, and reading localStorage straight from the initializer
  // avoids the extra collapsed-then-expands flash a mount effect would cause.
  const [collapsed, setCollapsed] = useState(readStoredSidebarCollapsed);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      writeStoredSidebarCollapsed(next);
      return next;
    });
  }

  // Where the user was when the inactivity timeout fired — read straight
  // from window.location instead of usePathname()/useSearchParams() since
  // it's only ever needed inside an event handler, not during render.
  const returnToRef = useRef<string | null>(null);

  // TOR-124: the session lives in an httpOnly cookie now, invisible to JS in
  // every tab — there's no shared browser-side event (like the old `storage`
  // write on sign-out) left to listen for, so each tab explicitly announces
  // its own sign-out via BroadcastChannel and every OTHER tab reacts here.
  // (A tab never receives its own broadcast, so this can't double-fire
  // alongside this tab's own logout/inactivity-timeout handling below.)
  useEffect(() => {
    return onSignedOutElsewhere(() => {
      clearCachedAuthUser();
      router.replace("/login?reason=signed-out-elsewhere");
    });
  }, [router]);

  // TOR-123: Supabase's refresh token doesn't expire on its own by
  // inactivity (lasts weeks) — without this a tab left open stays "logged
  // in" indefinitely. Ends the session immediately (not just on the modal's
  // button click) so a session left idle is actually dead, not just hidden
  // behind a dialog someone could dismiss by refreshing.
  useInactivityTimeout(
    INACTIVITY_TIMEOUT_MS,
    () => {
      returnToRef.current = window.location.pathname + window.location.search;
      clearCachedAuthUser();
      setSessionExpired(true);
      void logoutRequest();
      announceSignedOut();
    },
    !!authUser,
  );

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // Trusting the cache without re-validating the underlying session on
      // every mount (unlike the pre-TOR-124 version) isn't a choice here —
      // an httpOnly cookie can't be read from JS at all, so there's no local
      // "is there still a session" check left to do. Every /api/* call this
      // cached session goes on to make is still independently authorized
      // server-side (lib/auth/server-access-token.ts), so a stale cache
      // just means the first such call 401s instead of this mount catching
      // it — not a gap, just where the check ends up happening.
      const cached = readCachedAuthUser();
      if (cached) {
        if (!cancelled) {
          setAuthUser(cached);
          setChecking(false);
        }
        return;
      }

      // No cached role for this browser session (new tab, or a session
      // resumed from a previous visit) — re-confirm with the backend. This
      // also (re)logs auth.login, which is fine: it only fires once per
      // browser session, not once per navigation, since the cache above
      // short-circuits every mount after the first.
      const result = await verifySession();

      if (!result.ok) {
        // A rejected/invalid session on first load, not a real cross-tab
        // sign-out — no broadcast, just clean up and leave.
        if (result.status !== 401) await logoutRequest();
        if (!cancelled) router.replace("/login");
        return;
      }

      writeCachedAuthUser(result.user);
      if (!cancelled) {
        setAuthUser(result.user);
        setChecking(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await logoutRequest();
    clearCachedAuthUser();
    announceSignedOut();
    router.replace("/login");
  }

  if (sessionExpired) {
    return (
      <SessionExpiredDialog
        onLoginAgain={() => {
          const returnTo = returnToRef.current;
          const returnToParam =
            returnTo && returnTo !== "/" ? `&returnTo=${encodeReturnTo(returnTo)}` : "";
          router.replace(`/login?reason=inactivity${returnToParam}`);
        }}
      />
    );
  }

  if (checking || !authUser) return null;

  return (
    <AuthUserProvider user={authUser}>
      {/* h-screen (not min-h-full/flex-1) pins this row to exactly the
          viewport height, so the sidebar — which stretches to match it —
          never scrolls with the page. min-h-0 on the content pane is the
          usual flexbox fix needed for its own overflow-y-auto to actually
          kick in instead of growing the row past h-screen. */}
      <div className="flex h-screen bg-background">
        <Sidebar
          authUser={authUser}
          onLogout={handleLogout}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </AuthUserProvider>
  );
}