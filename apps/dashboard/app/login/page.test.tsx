import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => searchParams,
}));

const signInWithPassword = vi.fn();
const signOut = vi.fn();
vi.mock("../../lib/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  },
}));

import LoginPage from "./page";

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockClear();
  signInWithPassword.mockReset();
  signOut.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  searchParams = new URLSearchParams();
});

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));
}

describe("LoginPage", () => {
  it("shows an error and reports login-failed when Supabase rejects the credentials", async () => {
    signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "Invalid" } });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    render(<LoginPage />);
    fillAndSubmit("bad@example.com", "wrong");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/credenciales inválidas/i),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login-failed",
      expect.objectContaining({ method: "POST" }),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to / when login succeeds and the role is allowed", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "tok" } },
      error: null,
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "admin", status: "active" }), { status: 200 }),
    );

    render(<LoginPage />);
    fillAndSubmit("admin@example.com", "correct");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("signs the user out and shows an access error when the role is rejected (403)", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "tok" } },
      error: null,
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    render(<LoginPage />);
    fillAndSubmit("driver@example.com", "correct");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/no tiene acceso al panel administrativo/i),
    );
    expect(signOut).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the signed-out-elsewhere notice when redirected here with that reason", () => {
    searchParams = new URLSearchParams("reason=signed-out-elsewhere");

    render(<LoginPage />);

    expect(screen.getByText(/tu sesión se cerró/i)).toBeInTheDocument();
  });

  it("shows no notice on a plain visit to /login", () => {
    render(<LoginPage />);

    expect(screen.queryByText(/tu sesión se cerró/i)).not.toBeInTheDocument();
  });
});
