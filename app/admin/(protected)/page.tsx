"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { OverviewSkeleton, Skeleton, TableRowSkeleton } from "@/components/admin/skeleton";
import { fetchAdminJson } from "@/components/admin/fetch-json";
import { SortableTh, TableSortSelect } from "@/components/admin/sortable-th";
import {
  emptyTableSort,
  dateSortValue,
  nextTableSort,
  sortRows,
  type TableSortState,
} from "@/lib/admin/table-sort";
import { formatIstDateLabel } from "@/lib/automations/ist";
import type {
  AutomationOverview,
  AutomationRun,
  ChannelCounts,
} from "@/lib/automations/types";

interface OverviewResponse {
  ok: boolean;
  error?: string;
  totalLeads: number;
  automations: AutomationOverview[];
  runDays: string[];
}

interface DayRunsResponse {
  ok: boolean;
  error?: string;
  runs?: AutomationRun[];
}

type RunSortKey = "kind" | "trigger" | "status" | "sent" | "failed" | "when";

const RUN_SORT_OPTIONS: { key: RunSortKey; label: string }[] = [
  { key: "kind", label: "Automation" },
  { key: "trigger", label: "Trigger" },
  { key: "status", label: "Status" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "when", label: "When" },
];

function primaryCounts(item: AutomationOverview): ChannelCounts {
  return (
    item.counts.whatsapp ||
    item.counts.email || {
      sent: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      sending: 0,
    }
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await fetchAdminJson<OverviewResponse>("/api/admin/automations", {
          fresh: true,
        });
        if (!json.ok) {
          if (!cancelled) setError(json.error || "Could not load dashboard.");
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Could not load dashboard.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Overview</h1>
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (!data) {
    return <OverviewSkeleton />;
  }

  const stats = [
    {
      key: "leads",
      href: "/admin/leads",
      title: "Registered leads",
      value: data.totalLeads,
      detail: "Total candidates",
    },
    ...data.automations.map((item) => {
      const counts = primaryCounts(item);
      return {
        key: item.kind,
        href: `/admin/automations/${item.kind}`,
        title: item.title,
        value: counts.sent,
        detail: `${counts.pending} pending · ${counts.failed} failed`,
      };
    }),
  ];

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted sm:text-base">
          Java Full Stack Placement Drive — 22 August 2026, Marathahalli
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <Link
              key={stat.key}
              href={stat.href}
              className="flex min-h-[120px] flex-col justify-between bg-white p-4 transition hover:bg-slate-50 sm:p-5"
            >
              <div className="text-sm font-medium leading-snug text-muted">{stat.title}</div>
              <div>
                <div className="mt-3 font-heading text-3xl font-bold tabular-nums text-navy-900">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs leading-snug text-faint">{stat.detail}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-lg font-bold sm:text-xl">Automations</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {data.automations.map((item) => {
            const wa = item.counts.whatsapp;
            const email = item.counts.email;
            return (
              <Link
                key={item.kind}
                href={`/admin/automations/${item.kind}`}
                className="rounded-2xl bg-white p-5 shadow-card transition hover:shadow-card-lg sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted">{item.scheduleLabel}</p>
                  </div>
                  {item.isDue ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      Due
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Scheduled
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {wa ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      WhatsApp: <strong>{wa.sent}</strong> sent / {wa.pending} pending
                    </div>
                  ) : null}
                  {email ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      Email: <strong>{email.sent}</strong> sent / {email.pending} pending
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <RunsByDay days={data.runDays ?? []} />
    </div>
  );
}

function RunsByDay({ days }: { days: string[] }) {
  const [selectedDay, setSelectedDay] = useState(days[0] ?? "");
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(days.length > 0);
  const [loadError, setLoadError] = useState("");
  const [runSort, setRunSort] = useState<TableSortState<RunSortKey>>(emptyTableSort());
  const cacheRef = useRef<Record<string, AutomationRun[]>>({});
  const requestRef = useRef(0);

  useEffect(() => {
    if (!selectedDay) {
      setRuns([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current[selectedDay];
    if (cached) {
      setRuns(cached);
      setLoading(false);
      setLoadError("");
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setRuns([]);

    (async () => {
      try {
        const json = await fetchAdminJson<DayRunsResponse>(
          `/api/admin/automations/runs?date=${encodeURIComponent(selectedDay)}`,
          { fresh: true },
        );
        if (cancelled || requestId !== requestRef.current) return;
        if (!json.ok) {
          setLoadError(json.error || "Could not load runs for this day.");
          setRuns([]);
          return;
        }
        const next = json.runs ?? [];
        cacheRef.current[selectedDay] = next;
        setRuns(next);
      } catch {
        if (cancelled || requestId !== requestRef.current) return;
        setLoadError("Could not load runs for this day.");
        setRuns([]);
      } finally {
        if (!cancelled && requestId === requestRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const dayIndex = days.indexOf(selectedDay);
  const newerDay = dayIndex > 0 ? days[dayIndex - 1] : null;
  const olderDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;
  const dayOptions = useMemo(
    () => days.map((day) => ({ value: day, label: formatIstDateLabel(day) })),
    [days],
  );

  const sortedRuns = sortRows(runs, runSort, (run, key) => {
    if (key === "kind") return run.kind;
    if (key === "trigger") return run.triggeredBy;
    if (key === "status") return run.status;
    if (key === "sent") return run.stats.sent;
    if (key === "failed") return run.stats.failed;
    return dateSortValue(run.startedAt);
  });

  return (
    <section>
      <h2 className="font-heading text-lg font-bold sm:text-xl">Automation runs</h2>
      <p className="mt-1 text-sm text-muted">
        Choose an IST day to load every cron and admin job from that date.
      </p>
      {days.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              disabled={!olderDay}
              onClick={() => olderDay && setSelectedDay(olderDay)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Older day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Run date</span>
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm font-semibold text-navy-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                {dayOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </label>
            <button
              type="button"
              disabled={!newerDay}
              onClick={() => newerDay && setSelectedDay(newerDay)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Newer day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-faint sm:text-right" aria-live="polite">
            {loading
              ? `Loading jobs for ${formatIstDateLabel(selectedDay)}…`
              : `${runs.length} job${runs.length === 1 ? "" : "s"} · ${days.length} day${days.length === 1 ? "" : "s"} with runs`}
          </p>
        </div>
      ) : null}
      {!loading && runs.length > 0 ? (
        <TableSortSelect
          options={RUN_SORT_OPTIONS}
          sort={runSort}
          onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
          onClear={() => setRunSort(emptyTableSort())}
          className="mt-3 flex items-center gap-2 text-sm text-muted lg:hidden"
        />
      ) : null}
      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-card">
        {days.length === 0 ? (
          <p className="p-6 text-sm text-muted">No automation runs yet.</p>
        ) : loading ? (
          <div aria-busy="true" aria-live="polite">
            <div className="space-y-3 p-4 lg:hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {["S.No", "Automation", "Trigger", "Status", "Sent", "Failed", "When"].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 font-semibold">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={7} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-red-700">{loadError}</p>
        ) : runs.length === 0 ? (
          <p className="p-6 text-sm text-muted">No jobs ran on this day.</p>
        ) : (
          <>
            <div className="space-y-3 p-4 lg:hidden">
              {sortedRuns.map((run, i) => (
                <div key={run.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      <span className="mr-1.5 tabular-nums text-muted">{i + 1}.</span>
                      {run.kind}
                    </span>
                    <StatusBadge status={run.status === "completed" ? "sent" : "sending"} />
                  </div>
                  <div className="mt-2 text-muted">
                    {run.triggeredBy} · {run.stats.sent} sent · {run.stats.failed} failed
                  </div>
                  <div className="mt-1 text-xs text-faint">
                    {run.startedAt
                      ? new Date(run.startedAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">S.No</th>
                    <SortableTh
                      label="Automation"
                      column="kind"
                      sort={runSort}
                      onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                    />
                    <SortableTh
                      label="Trigger"
                      column="trigger"
                      sort={runSort}
                      onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                    />
                    <SortableTh
                      label="Status"
                      column="status"
                      sort={runSort}
                      onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                    />
                    <SortableTh
                      label="Sent"
                      column="sent"
                      sort={runSort}
                      onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                    />
                    <SortableTh
                      label="Failed"
                      column="failed"
                      sort={runSort}
                      onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                    />
                    <SortableTh
                      label="When"
                      column="when"
                      sort={runSort}
                      onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedRuns.map((run, i) => (
                    <tr key={run.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">{run.kind}</td>
                      <td className="px-4 py-3 capitalize">{run.triggeredBy}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status === "completed" ? "sent" : "sending"} />
                      </td>
                      <td className="px-4 py-3">{run.stats.sent}</td>
                      <td className="px-4 py-3">{run.stats.failed}</td>
                      <td className="px-4 py-3 text-muted">
                        {run.startedAt
                          ? new Date(run.startedAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
