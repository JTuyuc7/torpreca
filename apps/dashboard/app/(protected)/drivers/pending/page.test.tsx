import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("../../../../lib/supabase/client", () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

import PendingDriversPage from "./page";

const fetchMock = vi.fn();

const pendingUser = {
  id: "user-2",
  authUserId: "auth-2",
  name: "Nuevo Driver",
  role: "driver",
  status: "pending",
  deactivatedAt: null,
  deactivatedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("PendingDriversPage", () => {
  it("shows the empty state when there are no pending drivers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    render(<PendingDriversPage />);

    await waitFor(() => expect(screen.getByText("No hay solicitudes pendientes.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users?status=pending",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
  });

  it("lists pending drivers with Approve/Reject actions", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([pendingUser]), { status: 200 }));

    render(<PendingDriversPage />);

    await waitFor(() => expect(screen.getByText("Nuevo Driver")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
  });

  it("approving a driver calls the review endpoint and removes the row", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([pendingUser]), { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...pendingUser, status: "active" }), { status: 200 }),
    );

    render(<PendingDriversPage />);
    await waitFor(() => expect(screen.getByText("Nuevo Driver")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() => expect(screen.queryByText("Nuevo Driver")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/users/user-2/review",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ decision: "approve" }),
      }),
    );
  });

  it("shows an error message when the list request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    render(<PendingDriversPage />);

    await waitFor(() =>
      expect(screen.getByText("No se pudieron cargar las solicitudes pendientes.")).toBeInTheDocument(),
    );
  });
});