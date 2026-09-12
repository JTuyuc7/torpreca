import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "@torpreca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVehicle,
  deactivateVehicle,
  listAllVehicles,
  updateVehicle,
} from "@/lib/api/vehicles-client";
import { getAccessToken } from "@/lib/supabase/access-token";

const vehiclesQueryKey = ["vehicles"] as const;

// Fetches every vehicle (active + deactivated) — same "fetch all, let each
// screen filter" pattern as lib/hooks/use-users.ts. "Gestión de rutas"
// (TOR-30) filters to `active` for its assignment dropdown; "Gestión de
// vehículos" (TOR-44) shows everything so a deactivated one can be reactivated.
export function useVehicles() {
  const queryClient = useQueryClient();

  const vehiclesQuery = useQuery({
    queryKey: vehiclesQueryKey,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listAllVehicles(token);
      if (!result.ok) throw new Error("No se pudieron cargar los vehículos.");
      return result.vehicles;
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: async (input: CreateVehicleInput) => {
      const token = await getAccessToken();
      const result = await createVehicle(token, input);
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? "Ya existe un vehículo con esa placa."
            : "No se pudo crear el vehículo. Verifica los campos.",
        );
      }
      return result.vehicle;
    },
    onSuccess: (vehicle) => {
      queryClient.setQueryData<Vehicle[]>(vehiclesQueryKey, (prev) =>
        prev ? [vehicle, ...prev] : [vehicle],
      );
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async (vars: { id: string; input: UpdateVehicleInput }) => {
      const token = await getAccessToken();
      const result = await updateVehicle(token, vars.id, vars.input);
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? "Ya existe un vehículo con esa placa."
            : "No se pudo editar el vehículo.",
        );
      }
      return result.vehicle;
    },
    onSuccess: (vehicle) => {
      queryClient.setQueryData<Vehicle[]>(vehiclesQueryKey, (prev) =>
        prev?.map((v) => (v.id === vehicle.id ? vehicle : v)),
      );
    },
  });

  const deactivateVehicleMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const result = await deactivateVehicle(token, id);
      if (!result.ok) throw new Error("No se pudo desactivar el vehículo.");
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Vehicle[]>(vehiclesQueryKey, (prev) =>
        prev?.map((v) => (v.id === id ? { ...v, active: false } : v)),
      );
    },
  });

  return {
    vehicles: vehiclesQuery.data,
    isLoading: vehiclesQuery.isLoading,
    error: vehiclesQuery.error?.message ?? null,
    refetch: vehiclesQuery.refetch,
    createVehicle: createVehicleMutation,
    updateVehicle: updateVehicleMutation,
    deactivateVehicle: deactivateVehicleMutation,
  };
}