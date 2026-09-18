import type { CreateFavoriteRouteInput, FavoriteRoute } from "@torpreca/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFavoriteRoute,
  deleteFavoriteRoute,
  listFavoriteRoutes,
} from "@/lib/api/favorite-routes-client";
import { getAccessToken } from "@/lib/supabase/access-token";

const favoriteRoutesQueryKey = ["favorite-routes"] as const;

// Reusable A→B pairs for the "Calcular en mapa" modal in /rutas (TOR-127) —
// same list/create/delete shape as lib/hooks/use-vehicles.ts.
export function useFavoriteRoutes() {
  const queryClient = useQueryClient();

  const favoriteRoutesQuery = useQuery({
    queryKey: favoriteRoutesQueryKey,
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listFavoriteRoutes(token);
      if (!result.ok) throw new Error("No se pudieron cargar las rutas favoritas.");
      return result.favoriteRoutes;
    },
  });

  const createFavoriteRouteMutation = useMutation({
    mutationFn: async (input: CreateFavoriteRouteInput) => {
      const token = await getAccessToken();
      const result = await createFavoriteRoute(token, input);
      if (!result.ok) throw new Error("No se pudo guardar la ruta favorita.");
      return result.favoriteRoute;
    },
    onSuccess: (favoriteRoute) => {
      queryClient.setQueryData<FavoriteRoute[]>(favoriteRoutesQueryKey, (prev) =>
        prev ? [...prev, favoriteRoute] : [favoriteRoute],
      );
    },
  });

  const deleteFavoriteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const result = await deleteFavoriteRoute(token, id);
      if (!result.ok) throw new Error("No se pudo borrar la ruta favorita.");
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<FavoriteRoute[]>(favoriteRoutesQueryKey, (prev) =>
        prev?.filter((f) => f.id !== id),
      );
    },
  });

  return {
    favoriteRoutes: favoriteRoutesQuery.data,
    isLoading: favoriteRoutesQuery.isLoading,
    error: favoriteRoutesQuery.error?.message ?? null,
    createFavoriteRoute: createFavoriteRouteMutation,
    deleteFavoriteRoute: deleteFavoriteRouteMutation,
  };
}
