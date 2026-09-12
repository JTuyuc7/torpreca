"use client";

import type { AuthUser, Role } from "@torpreca/shared";
import { FileText, LayoutDashboard, LogOut, Menu, Route, Truck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout as logoutRequest, verifySession } from "@/lib/api/auth-client";
import { clearCachedAuthUser, readCachedAuthUser, writeCachedAuthUser } from "@/lib/auth/session-cache";
import { readStoredSidebarCollapsed, writeStoredSidebarCollapsed } from "@/lib/preferences/sidebar";
import { supabase } from "@/lib/supabase/client";
import { AuthUserProvider } from "./auth-context";

// Mirrors the sidebar nav in context/dashboard/assets/TorprecaDesignV2.pdf.
// "Conductores" is the mockup's label for people-management, which today
// lives at /users (TOR-42 — covers drivers, supervisors and admins, not only
// drivers). Panel Principal/Reportes have no screen yet (TOR-12, TOR-24) —
// shown disabled so the shell matches the approved design without linking to
// pages that don't exist. "Rutas" (TOR-30) got its screen at /rutas.
// "Vehículos" (TOR-44) isn't in that mockup at all — added because the
// screen needs to be reachable from somewhere; slotted next to Rutas since
// both feed the same route-assignment workflow.
const NAV_ITEMS: { label: string; href: string; enabled: boolean; icon: typeof Users }[] = [
  { label: "Panel Principal", href: "/", enabled: false, icon: LayoutDashboard },
  { label: "Conductores", href: "/users", enabled: true, icon: Users },
  { label: "Rutas", href: "/rutas", enabled: true, icon: Route },
  { label: "Vehículos", href: "/vehiculos", enabled: true, icon: Truck },
  { label: "Reportes", href: "/reportes", enabled: false, icon: FileText },
];

const ROLE_LABELS: Record<Role, string> = {
  driver: "Conductor",
  supervisor: "Supervisor",
  admin: "Administrador",
  super_admin: "Super Admin",
};

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
  const roleLabel = ROLE_LABELS[authUser.role];

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
              <p className="text-xs text-white/60">Administración</p>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 cursor-pointer"
          >
            <Menu size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = item.enabled && pathname === item.href;
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <span
                  key={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/40 ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon size={16} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[10px] uppercase tracking-wide">Próx.</span>
                    </>
                  )}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${collapsed ? "justify-center px-0" : ""} ${
                  // text-brand (dark, fixed) instead of white: --secondary is
                  // theme-tonal (a light peach in dark mode, see globals.css)
                  // — white text on it failed contrast, especially in dark
                  // mode where it was nearly unreadable.
                  active ? "bg-secondary text-brand" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                {!collapsed && item.label}
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
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
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
              Cerrar sesión
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

  // Set right before this tab's own signOut() call, so the onAuthStateChange
  // listener below can tell "I just logged myself out" (silent redirect)
  // apart from "signed out elsewhere" (another tab, or an expired/revoked
  // session) — the latter shows a message explaining why the user landed
  // back on /login.
  const loggingOutHereRef = useRef(false);

  // Supabase persists its session in localStorage (not cookies) and already
  // fires a `storage` event to every open tab on sign-out — this listener is
  // what actually reacts to it. Without it, a tab stays on a protected page
  // showing stale data/actions against a session that no longer exists,
  // until the user happens to navigate or reload.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      clearCachedAuthUser();
      if (loggingOutHereRef.current) {
        loggingOutHereRef.current = false;
        router.replace("/login");
      } else {
        router.replace("/login?reason=signed-out-elsewhere");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const cached = readCachedAuthUser();
      if (cached) {
        if (!cancelled) {
          setAuthUser(cached);
          setChecking(false);
        }
        return;
      }

      // No cached role for this browser session (new tab, or a Supabase
      // session resumed from a previous visit) — re-confirm with the
      // backend. This also (re)logs auth.login, which is fine: it only
      // fires once per browser session, not once per navigation, since the
      // cache above short-circuits every mount after the first.
      const result = await verifySession(session.access_token);

      if (!result.ok) {
        // Silent redirect (not the "signed out elsewhere" messaging below):
        // this is a rejected/invalid session on first load, not a real
        // sign-out event from another tab.
        loggingOutHereRef.current = true;
        await supabase.auth.signOut();
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      await logoutRequest(session.access_token);
    }

    loggingOutHereRef.current = true;
    // clearCachedAuthUser() + the /login redirect happen in the
    // onAuthStateChange listener above, triggered by this signOut() call —
    // single place for that logic, shared with the cross-tab case.
    await supabase.auth.signOut();
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