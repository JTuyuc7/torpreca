import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type AuditLogsFilter, listAuditLogs } from "@/lib/api/audit-logs-client";
import { getAccessToken } from "@/lib/supabase/access-token";

// TOR-135: the filter (event/user/date/page) is now server-side — it's part
// of the query key so changing any of it triggers a real refetch instead of
// re-slicing an already-fetched full table client-side.
export function useAuditLogs(filter: AuditLogsFilter) {
  const query = useQuery({
    queryKey: ["audit-logs", filter],
    queryFn: async () => {
      const token = await getAccessToken();
      const result = await listAuditLogs(token, filter);
      if (!result.ok) throw new Error("No se pudieron cargar los logs.");
      return result.page;
    },
    // Keeps the current page's rows on screen while the next page loads,
    // instead of flashing back to the loading skeleton on every click.
    placeholderData: keepPreviousData,
  });

  return {
    logs: query.data?.logs,
    total: query.data?.total,
    isLoading: query.isLoading,
    isRefetching: query.isFetching && !query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
