import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

import VehiculosPage from "./page";

const fetchMock = vi.fn();

const activeVehicle = {
  id: "v1",
  plate: "P-123ABC",
  model: "NPR",
  capacity: 10,
  category: "truck" as const,
  notes: null,
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const inactiveVehicle = {
  id: "v2",
  plate: "Q-999ZZZ",
  model: "Hilux",
  capacity: 4,
  category: "light_vehicle" as const,
  notes: "Llanta desgastada",
  active: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function renderPage() {
  return render(withQueryClient(<VehiculosPage />));
}

function openCreateDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Agregar vehículo" }));
}

function openEditDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
}

describe("VehiculosPage", () => {
  it("shows the empty state when there are no vehicles", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText("No hay vehículos registrados.")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles?all=true",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
  });

  it("lists vehicles including inactive ones, with an Estado badge", async () => {
    fetchMock.mockResolvedValue(jsonResponse([activeVehicle, inactiveVehicle]));

    renderPage();

    await waitFor(() => expect(screen.getByText("P-123ABC")).toBeInTheDocument());
    expect(screen.getByText("Q-999ZZZ")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("opens the create dialog and disables 'Guardar vehículo' until required fields are filled", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("No hay vehículos registrados.")).toBeInTheDocument(),
    );

    openCreateDialog();

    const submitButton = await screen.findByRole("button", { name: "Guardar vehículo" });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: "P-123ABC" } });
    fireEvent.change(screen.getByLabelText("Modelo"), { target: { value: "NPR" } });

    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  it("creating a vehicle posts the input, closes the dialog, and prepends it to the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    renderPage();
    await waitFor(() =>
      expect(screen.getByText("No hay vehículos registrados.")).toBeInTheDocument(),
    );

    openCreateDialog();

    fireEvent.change(screen.getByLabelText("Placa"), { target: { value: "P-123ABC" } });
    fireEvent.change(screen.getByLabelText("Modelo"), { target: { value: "NPR" } });

    const submitButton = await screen.findByRole("button", { name: "Guardar vehículo" });
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    fetchMock.mockResolvedValueOnce(jsonResponse(activeVehicle, 201));
    fireEvent.click(submitButton);

    await waitFor(() => expect(screen.getByText("P-123ABC")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Guardar vehículo" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/vehicles",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          plate: "P-123ABC",
          model: "NPR",
          capacity: null,
          category: "motorcycle",
          notes: "",
        }),
      }),
    );
  });

  it("shows the toggle-active action inside the edit dialog, labeled by vehicle state", async () => {
    fetchMock.mockResolvedValue(jsonResponse([activeVehicle, inactiveVehicle]));

    renderPage();
    await waitFor(() => expect(screen.getByText("P-123ABC")).toBeInTheDocument());

    const editButtons = screen.getAllByRole("button", { name: "Editar" });
    fireEvent.click(editButtons[0]);
    expect(await screen.findByRole("button", { name: "Desactivar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    fireEvent.click(editButtons[1]);
    expect(await screen.findByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("deactivating a vehicle asks for confirmation, then calls DELETE and flips its badge to Inactivo", async () => {
    fetchMock.mockResolvedValue(jsonResponse([activeVehicle]));

    renderPage();
    await waitFor(() => expect(screen.getByText("P-123ABC")).toBeInTheDocument());

    openEditDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar" }));

    // Confirmation step: DELETE hasn't fired yet from just clicking the
    // dialog's own toggle button — it only swaps the dialog into a
    // confirm view with an explicit "Sí, desactivar" action.
    expect(fetchMock).not.toHaveBeenCalledWith("/api/vehicles/v1", expect.anything());
    expect(await screen.findByText(/confirmas que quieres desactivar/i)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, desactivar" }));

    await waitFor(() => expect(screen.getByText("Inactivo")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/vehicles/v1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("cancelling the confirmation step returns to the edit form without calling the API", async () => {
    fetchMock.mockResolvedValue(jsonResponse([activeVehicle]));

    renderPage();
    await waitFor(() => expect(screen.getByText("P-123ABC")).toBeInTheDocument());

    openEditDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar" }));
    expect(await screen.findByText(/confirmas que quieres desactivar/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(await screen.findByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/vehicles/v1", expect.anything());
  });

  it("reactivating a vehicle PATCHes active: true after confirmation", async () => {
    fetchMock.mockResolvedValue(jsonResponse([inactiveVehicle]));

    renderPage();
    await waitFor(() => expect(screen.getByText("Q-999ZZZ")).toBeInTheDocument());

    openEditDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Reactivar" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...inactiveVehicle, active: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, reactivar" }));

    await waitFor(() => expect(screen.getByText("Activo")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/vehicles/v2",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ active: true }) }),
    );
  });

  it("editing a vehicle submits the changes via PATCH and closes the dialog", async () => {
    fetchMock.mockResolvedValue(jsonResponse([activeVehicle]));

    renderPage();
    await waitFor(() => expect(screen.getByText("P-123ABC")).toBeInTheDocument());

    openEditDialog();

    const modelInput = await screen.findByDisplayValue("NPR");
    fireEvent.change(modelInput, { target: { value: "NQR" } });

    const saveButton = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...activeVehicle, model: "NQR" }));
    fireEvent.click(saveButton);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
    });
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall?.[0]).toBe("/api/vehicles/v1");
    const body = JSON.parse((patchCall?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({ plate: "P-123ABC", model: "NQR" });
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });
});