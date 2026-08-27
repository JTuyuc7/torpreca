"use client";

import type { AuthUser } from "@torpreca/shared";
import { createContext, type ReactNode, useContext } from "react";

const AuthUserContext = createContext<AuthUser | null>(null);

export function AuthUserProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}

// Consumed by future role-gated screens (e.g. TOR-63's logs page, visible
// only when role === "super_admin") without redoing the session check.
export function useAuthUser(): AuthUser | null {
  return useContext(AuthUserContext);
}
