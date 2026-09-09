"use client";

import type { AuthUser, Role } from "@torpreca/shared";
import { FileText, LayoutDashboard, Route, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout as logoutRequest, verifySession } from "@/lib/api/auth-client";
import { clearCachedAuthUser, readCachedAuthUser, writeCachedAuthUser } from "@/lib/auth/session-cache";
import { supabase } from "@/lib/supabase/client";
import { AuthUserProvider } from "./auth-context";

// Mirrors the sidebar nav in context/dashboard/assets/TorprecaDesignV2.pdf.
// "Conductores" is the mockup's label for people-management, which today
// lives at /users (TOR-42 — covers drivers, supervisors and admins, not only
// drivers). Panel Principal/Rutas/Reportes have no screen yet (TOR-12,
// TOR-30, TOR-24) — shown disabled so the shell matches the approved design
// without linking to pages that don't exist.
const NAV_ITEMS: { label: string; href: string; enabled: boolean; icon: typeof Users }[] = [
  { label: "Panel Principal", href: "/", enabled: false, icon: LayoutDashboard },
  { label: "Conductores", href: "/users", enabled: true, icon: Users },
  { label: "Rutas", href: "/rutas", enabled: false, icon: Route },
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
function Sidebar({ authUser, onLogout }: { authUser: AuthUser; onLogout: () => void }) {
  const pathname = usePathname();
  const roleLabel = ROLE_LABELS[authUser.role];

  return (
    <aside className="flex w-60 flex-col justify-between bg-brand">
      <div>
        <div className="px-5 py-5">
          <p className="text-lg font-semibold tracking-tight text-white">TORPRECA</p>
          <p className="text-xs text-white/60">Administración</p>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = item.enabled && pathname === item.href;
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <span
                  key={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/40"
                >
                  <Icon size={16} />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] uppercase tracking-wide">Próx.</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  // text-brand (dark, fixed) instead of white: --secondary is
                  // theme-tonal (a light peach in dark mode, see globals.css)
                  // — white text on it failed contrast, especially in dark
                  // mode where it was nearly unreadable.
                  active ? "bg-secondary text-brand" : "text-white/80 hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-medium text-brand">
          {roleLabel[0]}
        </span>
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
      </div>
    </aside>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

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
        await supabase.auth.signOut();
        clearCachedAuthUser();
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

    await supabase.auth.signOut();
    clearCachedAuthUser();
    router.replace("/login");
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
        <Sidebar authUser={authUser} onLogout={handleLogout} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </AuthUserProvider>
  );
}