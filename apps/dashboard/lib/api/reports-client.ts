import type { ReportRangeQuery, RoutesReport } from "@torpreca/shared";

// Browser-side calls to this app's own /api/reports BFF route handlers — same
// centralization pattern as lib/api/routes-client.ts.

export type RoutesReportResult = { ok: true; report: RoutesReport } | { ok: false; status: number };

function rangeQuery(range: ReportRangeQuery): string {
  return new URLSearchParams({ from: range.from, to: range.to }).toString();
}

export async function getRoutesReport(range: ReportRangeQuery): Promise<RoutesReportResult> {
  try {
    const res = await fetch(`/api/reports/routes?${rangeQuery(range)}`);
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, report: (await res.json()) as RoutesReport };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type RoutesCsvResult = { ok: true } | { ok: false; status: number };

// Fetches the CSV and hands it to the browser as a file download.
export async function downloadRoutesCsv(range: ReportRangeQuery): Promise<RoutesCsvResult> {
  try {
    const res = await fetch(`/api/reports/routes/csv?${rangeQuery(range)}`);
    if (!res.ok) return { ok: false, status: res.status };

    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `routes-${range.from}_${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}
