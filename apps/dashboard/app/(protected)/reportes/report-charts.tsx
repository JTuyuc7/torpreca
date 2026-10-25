"use client";

import type { RoutesReport } from "@torpreca/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Section } from "@/components/ui/section";
import { useTranslation } from "@/lib/i18n/use-translation";

// Design System V2 tokens (globals.css) — they flip with the theme, so the
// charts follow light/dark without any theme logic here. Series order is fixed:
// primary first, secondary second (validated for color-blind separation and
// against both surfaces).
const SERIES_1 = "var(--primary)";
const SERIES_2 = "var(--secondary)";
const INK = "var(--text)";
const MUTED = "var(--outline)";
const SURFACE = "var(--surface)";

const CHART_HEIGHT = 240;
const TOP_DRIVERS = 8;

const AXIS = { fontSize: 11, fill: MUTED } as const;
const AXIS_LINE = { stroke: MUTED, strokeOpacity: 0.4 } as const;

function tooltipProps() {
  return {
    cursor: { fill: MUTED, fillOpacity: 0.1 },
    contentStyle: {
      background: "var(--background)",
      border: "1px solid color-mix(in srgb, var(--outline) 30%, transparent)",
      borderRadius: 8,
      fontSize: 12,
      color: INK,
    },
    labelStyle: { color: INK },
    itemStyle: { color: INK },
  } as const;
}

// Hairline, solid, recessive.
function Grid({ vertical = false }: { vertical?: boolean }) {
  return (
    <CartesianGrid
      vertical={vertical}
      horizontal={!vertical}
      stroke={MUTED}
      strokeOpacity={0.2}
      strokeWidth={1}
    />
  );
}

// "2026-09-12" -> "09-12". Plain string slicing: no Date, no timezone shift.
const shortDay = (date: string) => date.slice(5);

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-text">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ReportCharts({
  report,
  driverName,
}: {
  report: RoutesReport;
  driverName: (id: string) => string;
}) {
  const { t } = useTranslation();

  const statusData = report.byStatus
    .filter((s) => s.count > 0)
    .map((s) => ({ name: t.routeStatus[s.status], count: s.count }));
  const driverData = report.byDriver
    .slice(0, TOP_DRIVERS)
    .map((d) => ({ name: driverName(d.driverId), routes: d.routes }));

  return (
    <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-1">
      <Section title={t.reports.chartRoutesPerDay}>
        <div
          role="img"
          aria-label={t.reports.chartRoutesPerDay}
          style={{ height: CHART_HEIGHT }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.byDay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <Grid />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tick={AXIS}
                axisLine={AXIS_LINE}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipProps()} />
              <Bar
                dataKey="routes"
                name={t.reports.seriesRoutes}
                fill={SERIES_1}
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                stroke={SURFACE}
                strokeWidth={1}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title={t.reports.chartKmPerDay} description={t.reports.kmNote}>
        <Legend
          items={[
            { label: t.reports.seriesPlanned, color: SERIES_1 },
            { label: t.reports.seriesDriven, color: SERIES_2 },
          ]}
        />
        <div role="img" aria-label={t.reports.chartKmPerDay} style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={report.byDay} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <Grid />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tick={AXIS}
                axisLine={AXIS_LINE}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip
                {...tooltipProps()}
                cursor={{ stroke: MUTED, strokeOpacity: 0.4 }}
                formatter={(value) => `${value} ${t.reports.kmUnit}`}
              />
              <Line
                type="monotone"
                dataKey="plannedKm"
                name={t.reports.seriesPlanned}
                stroke={SERIES_1}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="drivenKm"
                name={t.reports.seriesDriven}
                stroke={SERIES_2}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title={t.reports.chartStatus}>
        <div role="img" aria-label={t.reports.chartStatus} style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={statusData}
              layout="vertical"
              margin={{ top: 0, right: 32, bottom: 0, left: 8 }}
            >
              <Grid vertical />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={96}
                tick={{ ...AXIS, fill: INK }}
                axisLine={AXIS_LINE}
                tickLine={false}
              />
              <Tooltip {...tooltipProps()} />
              <Bar
                dataKey="count"
                name={t.reports.seriesRoutes}
                fill={SERIES_1}
                maxBarSize={24}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                <LabelList dataKey="count" position="right" fill={INK} fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section
        title={t.reports.chartDrivers}
        description={report.byDriver.length > TOP_DRIVERS ? t.reports.topDrivers : undefined}
      >
        <div role="img" aria-label={t.reports.chartDrivers} style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={driverData}
              layout="vertical"
              margin={{ top: 0, right: 32, bottom: 0, left: 8 }}
            >
              <Grid vertical />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ ...AXIS, fill: INK }}
                axisLine={AXIS_LINE}
                tickLine={false}
              />
              <Tooltip {...tooltipProps()} />
              <Bar
                dataKey="routes"
                name={t.reports.seriesRoutes}
                fill={SERIES_1}
                maxBarSize={24}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                <LabelList dataKey="routes" position="right" fill={INK} fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
    </div>
  );
}
