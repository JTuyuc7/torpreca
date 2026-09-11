import type { CreateRouteInput, Route, UpdateRouteInput } from "@torpreca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRoute, listRoutes, updateRoute } from "@/lib/api/routes-client";
import { getAccessToken } from "@/lib/supabase/access-token";

const routesQueryKey = ["routes"] as const;

// Same pattern as lib/hooks/use-users.ts (TOR-42): the screen stays JSX,
// fetch/mutation logic lives here.
export function useRoutes() {
  const queryClient = useQueryClient();

  const routesQuery = useQuery({
    queryKey: routesQueryKey,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listRoutes(token);
      if (!result.ok) throw new Error("No se pudieron cargar las rutas.");
      return result.routes;
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      const token = await getAccessToken();
      const result = await createRoute(token, input);
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
      const token = await getAccessToken();
      const result = await updateRoute(token, vars.id, vars.input);
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

  return {
    routes: routesQuery.data,
    isLoading: routesQuery.isLoading,
    error: routesQuery.error?.message ?? null,
    createRoute: createRouteMutation,
    updateRoute: updateRouteMutation,
  };
}