"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type TooltipContentProps, type TooltipValueType,
} from "recharts";
import { Card, ErrorBox, Spinner, cx } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/api";
import { formatMinutes, formatPercent } from "@/lib/time";
import type { AgentReportRow, DailyReport, Metrics, ReportSummary, TeamReportRow } from "@/lib/types";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const axisTick = { fill: "var(--chart-axis)", fontSize: 12 };

function rangeFor(days: number): string {
  const to = new Date(Math.ceil(Date.now() / 60_000) * 60_000);
  const from = new Date(to.getTime() - days * 86_400_000);
  return `from=${from.toISOString()}&to=${to.toISOString()}`;
}

export default function DashboardPage() {
  const [days, setDaysState] = useState(30);
  // Fixed when the range is chosen, so the query key stays stable between renders.
  const [range, setRange] = useState(() => rangeFor(30));
  const setDays = (d: number) => {
    setDaysState(d);
    setRange(rangeFor(d));
  };

  const summary = useQuery({ queryKey: ["reports", "summary", range], queryFn: () => apiFetch<ReportSummary>(`/api/reports/summary?${range}`) });
  const daily = useQuery({ queryKey: ["reports", "daily", range], queryFn: () => apiFetch<DailyReport>(`/api/reports/daily?${range}`) });
  const teams = useQuery({ queryKey: ["reports", "teams", range], queryFn: () => apiFetch<TeamReportRow[]>(`/api/reports/teams?${range}`) });
  const agents = useQuery({ queryKey: ["reports", "agents", range], queryFn: () => apiFetch<AgentReportRow[]>(`/api/reports/agents?${range}`) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Performance</h1>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)} aria-pressed={days === r.days}
                    className={cx("rounded-md px-3 py-1 text-sm", days === r.days ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 dark:text-zinc-400")}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-zinc-500">Tickets created in the selected range. Times are business time (working hours only); open tickets are current.</p>

      {summary.isError ? <ErrorBox>{errorMessage(summary.error)}</ErrorBox> : <Kpis metrics={summary.data?.metrics} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tickets created vs. breached per day">
          {daily.isPending ? <Spinner /> : daily.isError ? <ErrorBox>{errorMessage(daily.error)}</ErrorBox> : daily.data.points.length === 0 ? (
            <Empty />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily.data.points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} minTickGap={24}
                         tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip content={(p) => <ChartTooltip {...p} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--chart-axis)" }} />
                  <Line type="monotone" dataKey="created" name="Created" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-surface)" }} />
                  <Line type="monotone" dataKey="breached" name="Breached" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-surface)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="SLA breach rate by team">
          {teams.isPending ? <Spinner /> : teams.isError ? <ErrorBox>{errorMessage(teams.error)}</ErrorBox> : (
            <HorizontalBars
              rows={teams.data.map((t) => ({ name: t.name, value: t.metrics.slaBreachRate === undefined ? null : t.metrics.slaBreachRate * 100 }))}
              format={(v) => `${Math.round(v * 10) / 10}%`} label="Breach rate" domainMax={100} />
          )}
        </Card>

        <Card title="Workload: open tickets per agent">
          {agents.isPending ? <Spinner /> : agents.isError ? <ErrorBox>{errorMessage(agents.error)}</ErrorBox> : (
            <HorizontalBars rows={agents.data.map((a) => ({ name: a.name, value: a.metrics.open, extra: a.capacity > 0 ? `of ${a.capacity} capacity` : undefined }))}
                            format={(v) => String(v)} label="Open tickets" />
          )}
        </Card>

        <Card title="Median first response per agent">
          {agents.isPending ? <Spinner /> : agents.isError ? <ErrorBox>{errorMessage(agents.error)}</ErrorBox> : (
            <HorizontalBars rows={agents.data.map((a) => ({ name: a.name, value: a.metrics.firstResponseMedianMinutes ?? null }))}
                            format={(v) => formatMinutes(v)} label="Median first response" />
          )}
        </Card>
      </div>

      <Card title="Agents">
        {agents.data && <AgentTable rows={agents.data} />}
      </Card>
    </div>
  );
}

function Kpis({ metrics }: { metrics?: Metrics }) {
  const tiles = [
    { label: "Tickets created", value: metrics ? String(metrics.created) : "…" },
    { label: "Open now", value: metrics ? String(metrics.open) : "…" },
    { label: "Median first response", value: metrics ? formatMinutes(metrics.firstResponseMedianMinutes) : "…" },
    { label: "Median resolution", value: metrics ? formatMinutes(metrics.resolutionMedianMinutes) : "…" },
    { label: "SLA breach rate", value: metrics ? formatPercent(metrics.slaBreachRate) : "…" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500">{t.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

interface BarRow {
  name: string;
  value: number | null;
  extra?: string;
}

/** Single-series horizontal bars: thin marks, rounded data end, value in the tooltip. */
function HorizontalBars({ rows, format, label, domainMax }: { rows: BarRow[]; format: (v: number) => string; label: string; domainMax?: number }) {
  const data = rows.filter((r) => r.value !== null) as (BarRow & { value: number })[];
  if (data.length === 0) return <Empty />;
  return (
    <div style={{ height: Math.max(120, data.length * 36 + 32) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={8}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" domain={[0, domainMax ?? "auto"]} tick={axisTick} tickLine={false} axisLine={false}
                 tickFormatter={(v: number) => format(v)} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={120} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "var(--chart-grid)", opacity: 0.5 }}
                   content={(p) => <ChartTooltip {...p} valueFormat={format} seriesLabel={label} />} />
          <Bar dataKey="value" name={label} fill="var(--series-1)" barSize={14} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip(props: TooltipContentProps<TooltipValueType, string | number> & { valueFormat?: (v: number) => string; seriesLabel?: string }) {
  const { active, payload, label, valueFormat, seriesLabel } = props;
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { extra?: string };
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span>{seriesLabel ?? p.name}</span>
          <span className="ml-auto font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
            {valueFormat ? valueFormat(Number(p.value)) : p.value}
          </span>
        </div>
      ))}
      {row.extra && <div className="mt-1 text-zinc-500">{row.extra}</div>}
    </div>
  );
}

/** The table view behind the charts: every number, readable without colour. */
function AgentTable({ rows }: { rows: AgentReportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-2 pr-2 font-medium">Agent</th>
            <th className="px-2 py-2 text-right font-medium">Open / capacity</th>
            <th className="px-2 py-2 text-right font-medium">Handled</th>
            <th className="px-2 py-2 text-right font-medium">Median first response</th>
            <th className="px-2 py-2 text-right font-medium">Median resolution</th>
            <th className="py-2 pl-2 text-right font-medium">Breach rate</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-2">{a.name}</td>
              <td className={cx("px-2 text-right", a.capacity > 0 && a.metrics.open >= a.capacity && "font-semibold text-red-700 dark:text-red-400")}>
                {a.metrics.open} / {a.capacity}
              </td>
              <td className="px-2 text-right">{a.metrics.created}</td>
              <td className="px-2 text-right">{formatMinutes(a.metrics.firstResponseMedianMinutes)}</td>
              <td className="px-2 text-right">{formatMinutes(a.metrics.resolutionMedianMinutes)}</td>
              <td className="pl-2 text-right">{formatPercent(a.metrics.slaBreachRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-zinc-500">No data in this range yet.</p>;
}
