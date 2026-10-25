import type { ReportRangeQuery } from "@torpreca/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getRoutesReport } from "@/lib/api/reports-client";

// The range is part of the query key, so applying another one is a real
// refetch; the previous report stays on screen meanwhile.
export function useRoutesReport(range: ReportRangeQuery) {
  const query = useQuery({
    queryKey: ["reports", "routes", range],
    queryFn: async () => {
      const result = await getRoutesReport(range);
      if (!result.ok) throw new Error("No se pudo cargar el reporte.");
      return result.report;
    },
    placeholderData: keepPreviousData,
  });

  return {
    report: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
