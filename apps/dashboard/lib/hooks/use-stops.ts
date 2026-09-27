import type { CreateStopBodyInput, Stop, UpdateStopInput } from "@torpreca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStop,
  deleteStop,
  listStops,
  reorderStops,
  updateStop,
} from "@/lib/api/stops-client";

const stopsQueryKey = (routeId: string) => ["stops", routeId] as const;

const NOT_PENDING_MESSAGE = "La ruta ya no está pendiente y sus paradas no se pueden editar.";

// Same pattern as lib/hooks/use-routes.ts (TOR-137). `enabled` lets the
// dialog only fetch once it's actually opened, instead of one request per
// row of the routes table.
export function useStops(routeId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const key = stopsQueryKey(routeId);

  const stopsQuery = useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => {
      const result = await listStops(routeId);
      if (!result.ok) throw new Error("No se pudieron cargar las paradas.");
      return result.stops;
    },
  });

  const createStopMutation = useMutation({
    mutationFn: async (input: CreateStopBodyInput) => {
      const result = await createStop(routeId, input);
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? NOT_PENDING_MESSAGE
            : result.status === 400
              ? "Datos inválidos. Verifica los campos."
              : "No se pudo agregar la parada.",
        );
      }
      return result.stop;
    },
    onSuccess: (stop) => {
      queryClient.setQueryData<Stop[]>(key, (prev) => (prev ? [...prev, stop] : [stop]));
    },
  });

  const updateStopMutation = useMutation({
    mutationFn: async (vars: { id: string; input: UpdateStopInput }) => {
      const result = await updateStop(vars.id, vars.input);
      if (!result.ok) {
        throw new Error(
          result.status === 409 ? NOT_PENDING_MESSAGE : "No se pudo editar la parada.",
        );
      }
      return result.stop;
    },
    onSuccess: (stop) => {
      queryClient.setQueryData<Stop[]>(key, (prev) =>
        prev?.map((s) => (s.id === stop.id ? stop : s)),
      );
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteStop(id);
      if (!result.ok) {
        throw new Error(
          result.status === 409 ? NOT_PENDING_MESSAGE : "No se pudo eliminar la parada.",
        );
      }
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Stop[]>(key, (prev) => prev?.filter((s) => s.id !== id));
    },
  });

  const reorderStopsMutation = useMutation({
    mutationFn: async (stopIds: string[]) => {
      const result = await reorderStops(routeId, stopIds);
      if (!result.ok) {
        throw new Error(
          result.status === 409 ? NOT_PENDING_MESSAGE : "No se pudo reordenar las paradas.",
        );
      }
      return result.stops;
    },
    onSuccess: (stops) => {
      queryClient.setQueryData<Stop[]>(key, stops);
    },
  });

  return {
    stops: stopsQuery.data,
    isLoading: stopsQuery.isLoading,
    error: stopsQuery.error?.message ?? null,
    refetch: stopsQuery.refetch,
    createStop: createStopMutation,
    updateStop: updateStopMutation,
    deleteStop: deleteStopMutation,
    reorderStops: reorderStopsMutation,
  };
}
