import type {
  CreateRouteInput,
  DuplicateRouteInput,
  Route,
  UpdateRouteInput,
} from "@torpreca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  closeRoute,
  createRoute,
  duplicateRoute,
  listRoutes,
  updateRoute,
} from "@/lib/api/routes-client";

const routesQueryKey = ["routes"] as const;

// Same pattern as lib/hooks/use-users.ts (TOR-42): the screen stays JSX,
// fetch/mutation logic lives here.
export function useRoutes() {
  const queryClient = useQueryClient();

  const routesQuery = useQuery({
    queryKey: routesQueryKey,
    queryFn: async () => {
      const result = await listRoutes();
      if (!result.ok) throw new Error("No se pudieron cargar las rutas.");
      return result.routes;
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      const result = await createRoute(input);
      if (!result.ok) {
        throw new Error(
          result.status === 400
            ? "Datos inválidos. Verifica los campos."
            : "No se pudo crear la ruta.",
        );
      }
      return result.route;
    },
    onSuccess: (route) => {
      queryClient.setQueryData<Route[]>(routesQueryKey, (prev) =>
        prev ? [route, ...prev] : [route],
      );
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async (vars: { id: string; input: UpdateRouteInput }) => {
      const result = await updateRoute(vars.id, vars.input);
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? "La ruta ya no está pendiente y no se puede editar."
            : "No se pudo editar la ruta.",
        );
      }
      return result.route;
    },
    onSuccess: (route) => {
      queryClient.setQueryData<Route[]>(routesQueryKey, (prev) =>
        prev?.map((r) => (r.id === route.id ? route : r)),
      );
    },
  });

  // "Duplicar": a new pending route (with its stops) modelled on `id`.
  const duplicateRouteMutation = useMutation({
    mutationFn: async (vars: { id: string; input: DuplicateRouteInput }) => {
      const result = await duplicateRoute(vars.id, vars.input);
      if (!result.ok) {
        throw new Error(
          result.status === 400
            ? "Datos inválidos. Verifica los campos."
            : result.status === 404
              ? "La ruta original ya no existe."
              : "No se pudo duplicar la ruta.",
        );
      }
      return result.route;
    },
    onSuccess: (route) => {
      queryClient.setQueryData<Route[]>(routesQueryKey, (prev) =>
        prev ? [route, ...prev] : [route],
      );
    },
  });

  // "Cerrar": an overdue in-progress route the driver never finished.
  const closeRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await closeRoute(id);
      if (!result.ok) {
        throw new Error(
          result.status === 409
            ? "La ruta ya no está en curso o todavía no está vencida."
            : "No se pudo cerrar la ruta.",
        );
      }
      return result.route;
    },
    onSuccess: (route) => {
      queryClient.setQueryData<Route[]>(routesQueryKey, (prev) =>
        prev?.map((r) => (r.id === route.id ? route : r)),
      );
    },
  });

  return {
    routes: routesQuery.data,
    isLoading: routesQuery.isLoading,
    error: routesQuery.error?.message ?? null,
    refetch: routesQuery.refetch,
    createRoute: createRouteMutation,
    updateRoute: updateRouteMutation,
    duplicateRoute: duplicateRouteMutation,
    closeRoute: closeRouteMutation,
  };
}
