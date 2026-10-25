"use client";

import {
  businessDate,
  REPORT_MAX_DAYS,
  type ReportRangeQuery,
  type RoutesReport,
} from "@torpreca/shared";
import { Download, FileText, Printer, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadRoutesCsv } from "@/lib/api/reports-client";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutesReport } from "@/lib/hooks/use-routes-report";
import { useUsers } from "@/lib/hooks/use-users";
import { useVehicles } from "@/lib/hooks/use-vehicles";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ReportCharts } from "./report-charts";

const DAY_MS = 24 * 60 * 60 * 1000;

// Plain-date arithmetic in UTC: no timezone or DST drift.
function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function lastDays(days: number): ReportRangeQuery {
  const to = businessDate();
  return { from: addDays(to, -(days - 1)), to };
}

function rangeProblem(range: ReportRangeQuery): "invalid" | "tooLong" | null {
  if (!range.from || !range.to || range.from > range.to) return "invalid";
  const span = (Date.parse(range.to) - Date.parse(range.from)) / DAY_MS + 1;
  return span > REPORT_MAX_DAYS ? "tooLong" : null;
}

const km = (value: number) => value.toLocaleString("es-GT", { maximumFractionDigits: 1 });

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-outline/20 bg-surface p-4">
      <span className="text-xs text-outline">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
      {hint && <span className="text-xs text-outline">{hint}</span>}
    </div>
  );
}

type GroupRow = { key: string; label: string; routes: number; completed: number; plannedKm: number; drivenKm: number };

function GroupTable({ title, firstColumn, rows }: { title: string; firstColumn: string; rows: GroupRow[] }) {
  const { t } = useTranslation();
  return (
    <Section title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline/20 text-xs text-outline">
              <th className="py-2 pr-4 font-medium">{firstColumn}</th>
              <th className="py-2 pr-4 text-right font-medium">{t.reports.colRoutes}</th>
              <th className="py-2 pr-4 text-right font-medium">{t.reports.colCompleted}</th>
              <th className="py-2 pr-4 text-right font-medium">{t.reports.colPlannedKm}</th>
              <th className="py-2 text-right font-medium">{t.reports.colDrivenKm}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-outline/10 text-text last:border-0">
                <td className="py-2 pr-4">{row.label}</td>
                <td className="py-2 pr-4 text-right">{row.routes}</td>
                <td className="py-2 pr-4 text-right">{row.completed}</td>
                <td className="py-2 pr-4 text-right">{km(row.plannedKm)}</td>
                <td className="py-2 text-right">{km(row.drivenKm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ReportBody({
  report,
  driverName,
  vehiclePlate,
}: {
  report: RoutesReport;
  driverName: (id: string) => string;
  vehiclePlate: (id: string | null) => string;
}) {
  const { t } = useTranslation();
  const { totals } = report;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t.reports.kpiRoutes} value={String(totals.routes)} />
        <Kpi
          label={t.reports.kpiCompleted}
          value={String(totals.completed)}
          hint={`${Math.round(totals.completionRate * 100)} %`}
        />
        <Kpi label={t.reports.kpiPlannedKm} value={km(totals.plannedKm)} hint={t.reports.kmNote} />
        <Kpi label={t.reports.kpiDrivenKm} value={km(totals.drivenKm)} />
      </div>

      <ReportCharts report={report} driverName={driverName} />

      <GroupTable
        title={t.reports.byDriverTitle}
        firstColumn={t.reports.colDriver}
        rows={report.byDriver.map((d) => ({ ...d, key: d.driverId, label: driverName(d.driverId) }))}
      />
      <GroupTable
        title={t.reports.byVehicleTitle}
        firstColumn={t.reports.colVehicle}
        rows={report.byVehicle.map((v) => ({
          ...v,
          key: v.vehicleId ?? "none",
          label: vehiclePlate(v.vehicleId),
        }))}
      />
    </div>
  );
}

export default function ReportesPage() {
  const { t } = useTranslation();
  usePageTitle(t.reports.title);

  const [draft, setDraft] = useState<ReportRangeQuery>(() => lastDays(30));
  const [applied, setApplied] = useState<ReportRangeQuery>(draft);
  const [csvState, setCsvState] = useState<"idle" | "downloading" | "error">("idle");

  const { report, isLoading, error, refetch } = useRoutesReport(applied);
  const { users } = useUsers();
  const { vehicles } = useVehicles();

  const driverName = (id: string) => users?.find((u) => u.id === id)?.name ?? id;
  const vehiclePlate = (id: string | null) =>
    id ? (vehicles?.find((v) => v.id === id)?.plate ?? id) : t.reports.unassigned;

  const problem = rangeProblem(draft);

  function generate(e: FormEvent) {
    e.preventDefault();
    if (!problem) setApplied(draft);
  }

  function applyPreset(days: number) {
    const range = lastDays(days);
    setDraft(range);
    setApplied(range);
  }

  async function downloadCsv() {
    setCsvState("downloading");
    const result = await downloadRoutesCsv(applied);
    setCsvState(result.ok ? "idle" : "error");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl text-text">{t.reports.title}</h1>
          <p className="text-sm text-outline">{t.reports.subtitle}</p>
          {/* Only on paper: the filters are hidden there, so say which period it is. */}
          <p className="hidden text-sm text-text print:block">
            {t.reports.printTitle} · {applied.from} – {applied.to}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={csvState === "downloading"}
            className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} />
            {csvState === "downloading" ? t.reports.downloadingCsv : t.reports.downloadCsv}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
          >
            <Printer size={14} />
            {t.reports.print}
          </button>
        </div>
      </div>

      {csvState === "error" && <ErrorBanner message={t.reports.csvError} />}

      <div className="print:hidden">
        <Section title={t.reports.rangeTitle}>
          <form onSubmit={generate} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="reportFrom" className="text-xs text-outline">
                {t.reports.fromLabel}
              </label>
              <Input
                id="reportFrom"
                type="date"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="reportTo" className="text-xs text-outline">
                {t.reports.toLabel}
              </label>
              <Input
                id="reportTo"
                type="date"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                className="w-40"
              />
            </div>
            <button
              type="submit"
              disabled={problem !== null}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Search size={14} />
              {t.reports.generate}
            </button>
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => applyPreset(days)}
                className="flex h-9 items-center text-sm text-outline hover:underline cursor-pointer"
              >
                {days === 7 ? t.reports.last7 : days === 30 ? t.reports.last30 : t.reports.last90}
              </button>
            ))}
          </form>
          {problem && (
            <p role="alert" className="text-xs text-error">
              {problem === "invalid" ? t.reports.invalidRange : t.reports.rangeTooLong}
            </p>
          )}
        </Section>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.reports.loadingLabel}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {report && report.totals.routes === 0 && (
        <EmptyState
          icon={FileText}
          title={t.reports.noDataTitle}
          description={t.reports.noDataDescription}
        />
      )}

      {report && report.totals.routes > 0 && (
        <ReportBody report={report} driverName={driverName} vehiclePlate={vehiclePlate} />
      )}
    </div>
  );
}
