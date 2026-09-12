import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/api/dashboard-client";
import { getAccessToken } from "@/lib/supabase/access-token";

// Polled, not pushed over the WebSocket — the "tracking" topic only carries
// location pings (see core/ws/tracking-handlers.ts on the backend), and
// wiring a second broadcast type for counts that change slowly (routes
// starting/finishing, a vehicle being deactivated) isn't worth it yet.
const REFETCH_INTERVAL_MS = 30_000;

export function useDashboardSummary() {
  const query = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await getDashboardSummary(token);
      if (!result.ok) throw new Error("No se pudieron cargar las métricas.");
      return result.summary;
    },
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}