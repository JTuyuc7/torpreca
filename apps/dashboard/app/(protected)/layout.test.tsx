import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
// Real Next.js router (a real `useRouter()`) returns the same object across
// renders — a fresh literal here made the layout's verify() effect (which
// depends on `router`) re-run on every render, which stayed harmless until
// TOR-123's setSessionExpired(true) triggered a real re-render and exposed
// it as a genuine bug.
const router = { push: vi.fn(), replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/",
}));

const announceSignedOut = vi.fn();
let crossTabListener: (() => void) | null = null;
// TOR-124: replaces the old Supabase onAuthStateChange mock — the session
// moved to an httpOnly cookie, so cross-tab sign-out notification is now
// this app's own BroadcastChannel wrapper instead of a Supabase SDK event.
vi.mock("@/lib/auth/session-broadcast", () => ({
  announceSignedOut: (...args: unknown[]) => announceSignedOut(...args),
  onSignedOutElsewhere: (cb: () => void) => {
    crossTabListener = cb;
    return () => {
      crossTabListener = null;
    };
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
  announceSignedOut.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
  window.localStorage.clear();
  inactivityTimeoutCallback = null;
  crossTabListener = null;
});

describe("ProtectedLayout", () => {
  it("redirects to /login when there is no session", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    // No session to sign out of — /api/auth/session (the check itself) is
    // the only call, not /api/auth/logout too.
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/logout", expect.anything());
  });

  it("renders children using the cached AuthUser without calling the backend", async () => {
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
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    render(
      <ProtectedLayout>
        <p>secret</p>
      </ProtectedLayout>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("collapses the sidebar to icon-only when the toggle is clicked", async () => {
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

    // Simulates this app's own BroadcastChannel notification of a sign-out
    // that happened in a different tab — nothing in this tab logged out.
    crossTabListener?.();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?reason=signed-out-elsewhere"),
    );
  });

  it("hides 'Logs del sistema' from the nav for a non-super_admin role", async () => {
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
    expect(inactivityTimeoutCallback).not.toBeNull();

    inactivityTimeoutCallback?.();

    await waitFor(() => expect(screen.getByText("Tu sesión expiró")).toBeInTheDocument());
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(announceSignedOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("torpreca:auth-user")).toBeNull();
  });

  it("clicking 'Iniciar sesión de nuevo' on the expired dialog redirects with the inactivity reason", async () => {
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

    inactivityTimeoutCallback?.();
    await waitFor(() => expect(screen.getByText("Tu sesión expiró")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión de nuevo" }));

    expect(replace).toHaveBeenCalledWith("/login?reason=inactivity");
  });

  it("carries an encoded returnTo when the timeout fires off the home page", async () => {
    window.history.pushState({}, "", "/users/42?tab=history");
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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(announceSignedOut).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalledWith("/login?reason=signed-out-elsewhere");
  });
});
