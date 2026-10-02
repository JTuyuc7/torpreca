import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

import SetPasswordPage from "./page";

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

async function fillAndSubmit(password: string, confirmPassword: string) {
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirma tu contraseña/i), {
    target: { value: confirmPassword },
  });
  const submitButton = screen.getByRole("button", { name: /guardar y continuar/i });
  await waitFor(() => expect(submitButton).not.toBeDisabled());
  fireEvent.click(submitButton);
}

describe("SetPasswordPage", () => {
  it("redirects to / when the password is saved", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "admin", status: "active" }), { status: 200 }),
    );

    render(<SetPasswordPage />);
    await fillAndSubmit("supersecret1", "supersecret1");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/set-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ password: "supersecret1", confirmPassword: "supersecret1" }),
        }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("shows an error when the passwords don't match", async () => {
    render(<SetPasswordPage />);
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "supersecret1" } });
    fireEvent.change(screen.getByLabelText(/confirma tu contraseña/i), {
      target: { value: "different1" },
    });

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    render(<SetPasswordPage />);
    await fillAndSubmit("supersecret1", "supersecret1");

    expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo guardar la contraseña/i);
    expect(push).not.toHaveBeenCalled();
  });
});
