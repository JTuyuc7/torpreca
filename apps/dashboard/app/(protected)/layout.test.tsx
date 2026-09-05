import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

const getSession = vi.fn();
const signOut = vi.fn();
vi.mock("../../lib/supabase/client", () => ({
  supabase: { auth: { getSession: () => getSession(), signOut: () => signOut() } },
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
});
