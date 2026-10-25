import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type RoutesSearchFilter, searchRoutes } from "@/lib/api/routes-client";

// Same idea as use-audit-logs.ts: the filters and the page are part of the
// query key, so changing any of them is a real (server-side) refetch. Its key
// starts with "routes" so use-routes.ts's mutations can invalidate it.
export const routesSearchKey = ["routes", "search"] as const;

export function useRoutesSearch(filter: RoutesSearchFilter) {
  const query = useQuery({
    queryKey: [...routesSearchKey, filter],
    queryFn: async () => {
      const result = await searchRoutes(filter);
      if (!result.ok) throw new Error("No se pudieron cargar las rutas.");
      return result.page;
    },
    // Keeps the current rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
  });

  return {
    routes: query.data?.items,
    total: query.data?.total,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
