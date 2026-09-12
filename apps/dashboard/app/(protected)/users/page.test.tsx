import type { Role } from "@torpreca/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";
import { AuthUserProvider } from "../auth-context";

const getSession = vi.fn();
vi.mock("../../../lib/supabase/client", () => ({
  supabase: { auth: { getSession: () => getSession() } },
}));

import UsersPage from "./page";

// Defaults to super_admin — most tests exercise behavior that doesn't depend
// on role-gating (list/deactivate/review); the role-gating tests below pass
// an explicit role.
function renderPage(role: Role = "super_admin") {
  return render(
    withQueryClient(
      <AuthUserProvider user={{ id: "current-user", role, status: "active" }}>
        <UsersPage />
      </AuthUserProvider>,
    ),
  );
}

const fetchMock = vi.fn();

const activeUser = {
  id: "user-1",
  authUserId: "auth-1",
  name: "Admin Torpreca",
  email: "admin@torpreca.gt",
  role: "admin",
  status: "active",
  deactivatedAt: null,
  deactivatedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const pendingUser = {
  id: "user-3",
  authUserId: "auth-3",
  name: "Nuevo Driver",
  email: "nuevo-driver@example.com",
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

describe("UsersPage", () => {
  it("shows the empty state when there are no users", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    renderPage();

    await waitFor(() => expect(screen.getByText("No hay usuarios registrados.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users?status=all",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
  });

  it("lists users with a Desactivar action", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([activeUser]), { status: 200 }));

    renderPage();

    await waitFor(() => expect(screen.getByText("Admin Torpreca")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeInTheDocument();
  });

  it("deactivating a user calls the delete endpoint and updates its status", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([activeUser]), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderPage();
    await waitFor(() => expect(screen.getByText("Admin Torpreca")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(screen.getByText("Desactivado")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/users/user-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(screen.queryByRole("button", { name: "Desactivar" })).not.toBeInTheDocument();
  });

  it("hides the 'Agregar usuario' form for a non-super_admin", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([activeUser]), { status: 200 }));

    renderPage("admin");

    await waitFor(() => expect(screen.getByText("Admin Torpreca")).toBeInTheDocument());
    expect(screen.queryByText("Agregar usuario")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Auth User ID (Supabase)")).not.toBeInTheDocument();
  });

  it("shows the 'Agregar usuario' form for a super_admin", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([activeUser]), { status: 200 }));

    renderPage("super_admin");

    await waitFor(() => expect(screen.getByText("Agregar usuario")).toBeInTheDocument());
  });

  it("creating a user calls the create endpoint and prepends it to the list", async () => {
    const newUser = { ...activeUser, id: "user-2", name: "Nuevo Supervisor", role: "supervisor" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(newUser), { status: 201 }));

    renderPage();
    await waitFor(() => expect(screen.getByText("No hay usuarios registrados.")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Auth User ID (Supabase)"), {
      target: { value: "11111111-1111-4111-8111-111111111112" },
    });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo Supervisor" } });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "supervisor@torpreca.gt" },
    });
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "supervisor" } });

    const submitButton = screen.getByRole("button", { name: "Crear usuario" });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    fireEvent.click(submitButton);

    await waitFor(() => expect(screen.getByText("Nuevo Supervisor")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          authUserId: "11111111-1111-4111-8111-111111111112",
          name: "Nuevo Supervisor",
          email: "supervisor@torpreca.gt",
          role: "supervisor",
        }),
      }),
    );
  });

  it("shows an error message when the list request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    renderPage();

    await waitFor(() => expect(screen.getByText("No se pudieron cargar los usuarios.")).toBeInTheDocument());
  });

  it("lists pending drivers separately with Approve/Reject actions", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([pendingUser]), { status: 200 }));

    renderPage();

    await waitFor(() => expect(screen.getByText("Nuevo Driver")).toBeInTheDocument());
    expect(screen.getByText("Conductores por aprobar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
  });

  it("approving a pending driver calls the review endpoint and moves it out of the pending section", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([pendingUser]), { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...pendingUser, status: "active" }), { status: 200 }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText("Nuevo Driver")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() => expect(screen.queryByText("Conductores por aprobar")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/users/user-3/review",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ decision: "approve", role: "driver" }),
      }),
    );
    expect(screen.getByText("Nuevo Driver")).toBeInTheDocument();
  });

  it("approving with a promoted role sends that role in the review request", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([pendingUser]), { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...pendingUser, status: "active", role: "supervisor" }), {
        status: 200,
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText("Nuevo Driver")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Aprobar como"), { target: { value: "supervisor" } });
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/users/user-3/review",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ decision: "approve", role: "supervisor" }),
        }),
      ),
    );
  });
});