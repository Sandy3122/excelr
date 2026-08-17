"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/admin/status-badge";
import { OverviewSkeleton } from "@/components/admin/skeleton";
import { fetchAdminJson } from "@/components/admin/fetch-json";
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
  recentRuns: AutomationRun[];
}

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
        const json = await fetchAdminJson<OverviewResponse>("/api/admin/automations");
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
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Overview</h1>
        <p className="mt-1 text-sm text-muted sm:text-base">
          Java Full Stack Placement Drive — 22 August 2026, Marathahalli
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="grid grid-cols-1 gap-px bg-slate-100 min-[420px]:grid-cols-2 lg:grid-cols-5">
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
        <div className="grid gap-4 md:grid-cols-2">
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

      <section>
        <h2 className="mb-3 font-heading text-lg font-bold sm:text-xl">Recent sends</h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          {data.recentRuns.length === 0 ? (
            <p className="p-6 text-sm text-muted">No automation runs yet.</p>
          ) : (
            <>
              <div className="space-y-3 p-4 md:hidden">
                {data.recentRuns.map((run, i) => (
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
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">S.No</th>
                      <th className="px-4 py-3">Automation</th>
                      <th className="px-4 py-3">Trigger</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sent</th>
                      <th className="px-4 py-3">Failed</th>
                      <th className="px-4 py-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRuns.map((run, i) => (
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
    </div>
  );
}
