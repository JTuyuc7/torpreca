"use client";

import type { AuthUser } from "@torpreca/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCachedAuthUser, readCachedAuthUser, writeCachedAuthUser } from "../../lib/auth/session-cache";
import { supabase } from "../../lib/supabase/client";
import { AuthUserProvider } from "./auth-context";

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
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        await supabase.auth.signOut();
        clearCachedAuthUser();
        if (!cancelled) router.replace("/login");
        return;
      }

      const user = (await res.json()) as AuthUser;
      writeCachedAuthUser(user);
      if (!cancelled) {
        setAuthUser(user);
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
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
      }).catch(() => {});
    }

    await supabase.auth.signOut();
    clearCachedAuthUser();
    router.replace("/login");
  }

  if (checking || !authUser) return null;

  return (
    <AuthUserProvider user={authUser}>
      <div className="flex flex-1 flex-col bg-background">
        <header className="flex items-center justify-between border-b border-outline/30 bg-surface px-6 py-3">
          <span className="text-sm text-text">Torpreca — {authUser.role}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-medium text-primary hover:underline"
          >
            Cerrar sesión
          </button>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </AuthUserProvider>
  );
}
