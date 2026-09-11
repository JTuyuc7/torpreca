import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
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
