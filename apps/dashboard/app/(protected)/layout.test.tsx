import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
// Real Next.js router (a real `useRouter()`) returns the same object across
// renders — a fresh literal here made the layout's verify()/onAuthStateChange
// effects (both dependent on `router`) re-run on every render, which stayed
// harmless until TOR-123's setSessionExpired(true) triggered a real
// re-render and exposed it as a genuine bug: verify() would refire, find
// clearCachedAuthUser() had already run, and re-sign-out through a stale
// "loggingOutHereRef" path.
const router = { push: vi.fn(), replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
}));

const getSession = vi.fn();
// Real signOut() triggers Supabase's own onAuthStateChange listeners
// (that's the whole cross-tab mechanism) — the mock does the same so
// handleLogout's self-initiated-vs-external distinction is exercised
// realistically instead of assumed.
const signOut = vi.fn(() => {
  authStateCallback?.("SIGNED_OUT");
});
let authStateCallback: ((event: string) => void) | null = null;
const unsubscribe = vi.fn();
vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      signOut: () => signOut(),
      onAuthStateChange: (cb: (event: string) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  },
}));

let inactivityTimeoutCallback: (() => void) | null = null;
vi.mock("@/lib/hooks/use-inactivity-timeout", () => ({
  useInactivityTimeout: (_ms: number, onTimeout: () => void, enabled = true) => {
    inactivityTimeoutCallback = enabled ? onTimeout : null;
  },
}));

import ProtectedLayout from "./layout";

const fetchMock = vi.fn();

beforeEach(() => {
  replace.mockClear();
  getSession.mockReset();
  signOut.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
  window.localStorage.clear();
  inactivityTimeoutCallback = null;
});

describe("ProtectedLayout", () => {
  it("redirects to /login when there is no Supabase session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders children using the cached AuthUser without calling the backend", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );

    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-verifies with the backend and signs out when the role is rejected", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(signOut).toHaveBeenCalled();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("collapses the sidebar to icon-only when the toggle is clicked", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    expect(screen.getByText("TORPRECA")).toBeInTheDocument();
    expect(screen.getByText("Conductores")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Colapsar menú" }));

    expect(screen.queryByText("TORPRECA")).not.toBeInTheDocument();
    expect(screen.queryByText("Conductores")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conductores" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expandir menú" }));
    expect(screen.getByText("TORPRECA")).toBeInTheDocument();
  });

  it("persists the collapsed state across remounts (e.g. a reload)", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    const { unmount } = render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Colapsar menú" }));
    expect(window.localStorage.getItem("torpreca:sidebar-collapsed")).toBe("true");
    unmount();

    // A fresh mount (what a real page reload produces) should come up
    // already collapsed instead of resetting to expanded.
    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());
    expect(screen.queryByText("TORPRECA")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expandir menú" })).toBeInTheDocument();
  });

  it("redirects with a message when signed out happens in another tab", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    // Simulates Supabase's own storage-event-driven notification of a
    // sign-out that happened in a different tab — nothing in this tab
    // called signOut() itself.
    authStateCallback?.("SIGNED_OUT");

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?reason=signed-out-elsewhere"),
    );
  });

  it("hides 'Logs del sistema' from the nav for a non-super_admin role", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    expect(screen.queryByText("Logs del sistema")).not.toBeInTheDocument();
  });

  it("shows 'Logs del sistema' in the nav for super_admin", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "super_admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Logs del sistema" })).toBeInTheDocument();
  });

  it("shows a blocking session-expired dialog on inactivity timeout, signs out, and doesn't redirect on its own", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());
    expect(inactivityTimeoutCallback).not.toBeNull();

    inactivityTimeoutCallback?.();

    await waitFor(() => expect(screen.getByText("Tu sesión expiró")).toBeInTheDocument());
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(signOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("torpreca:auth-user")).toBeNull();
  });

  it("clicking 'Iniciar sesión de nuevo' on the expired dialog redirects with the inactivity reason", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    inactivityTimeoutCallback?.();
    await waitFor(() => expect(screen.getByText("Tu sesión expiró")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión de nuevo" }));

    expect(replace).toHaveBeenCalledWith("/login?reason=inactivity");
  });

  it("carries an encoded returnTo when the timeout fires off the home page", async () => {
    window.history.pushState({}, "", "/users/42?tab=history");
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    inactivityTimeoutCallback?.();
    await waitFor(() => expect(screen.getByText("Tu sesión expiró")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión de nuevo" }));

    const [url] = replace.mock.calls[0] as [string];
    expect(url).toMatch(/^\/login\?reason=inactivity&returnTo=/);
    expect(url).not.toContain("/users/42");
    const encoded = new URLSearchParams(url.split("?")[1]).get("returnTo")!;
    expect(decodeURIComponent(atob(encoded))).toBe("/users/42?tab=history");

    window.history.pushState({}, "", "/");
  });

  it("clicking 'Cerrar sesión' redirects without the cross-tab message", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem(
      "torpreca:auth-user",
      JSON.stringify({ id: "u1", role: "admin", status: "active" }),
    );
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );
    await waitFor(() => expect(screen.getByText("secret")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(replace).not.toHaveBeenCalledWith("/login?reason=signed-out-elsewhere");
  });
});
