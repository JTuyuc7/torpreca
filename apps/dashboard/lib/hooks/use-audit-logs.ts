import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/api/audit-logs-client";
import { getAccessToken } from "@/lib/supabase/access-token";

export function useAuditLogs() {
  const query = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listAuditLogs(token);
      if (!result.ok) throw new Error("No se pudieron cargar los logs.");
      return result.logs;
    },
  });

  return {
    logs: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
