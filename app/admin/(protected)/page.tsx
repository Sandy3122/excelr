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
        <h1 className="font-heading text-3xl font-bold text-navy-900">Overview</h1>
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (!data) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold text-navy-900">Overview</h1>
        <p className="mt-1 text-muted">
          Java Full Stack Placement Drive — 22 August 2026, Marathahalli
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="text-sm font-medium text-muted">Registered leads</div>
          <div className="mt-2 font-heading text-3xl font-bold">{data.totalLeads}</div>
        </div>
        {data.automations.map((item) => {
          const counts = primaryCounts(item);
          return (
            <Link
              key={item.kind}
              href={`/admin/automations/${item.kind}`}
              className="rounded-2xl bg-white p-5 shadow-card transition hover:shadow-card-lg"
            >
              <div className="text-sm font-medium text-muted">{item.title}</div>
              <div className="mt-2 font-heading text-3xl font-bold">{counts.sent}</div>
              <div className="mt-1 text-xs text-faint">
                {counts.pending} pending · {counts.failed} failed
              </div>
            </Link>
          );
        })}
      </div>

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold">Automations</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.automations.map((item) => {
            const wa = item.counts.whatsapp;
            const email = item.counts.email;
            return (
              <Link
                key={item.kind}
                href={`/admin/automations/${item.kind}`}
                className="rounded-2xl bg-white p-6 shadow-card transition hover:shadow-card-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-lg font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted">{item.scheduleLabel}</p>
                  </div>
                  {item.isDue ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      Due
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Scheduled
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {wa ? (
                    <span>
                      WhatsApp: <strong>{wa.sent}</strong> sent / {wa.pending} pending
                    </span>
                  ) : null}
                  {email ? (
                    <span>
                      Email: <strong>{email.sent}</strong> sent / {email.pending} pending
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl font-bold">Recent sends</h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          {data.recentRuns.length === 0 ? (
            <p className="p-6 text-sm text-muted">No automation runs yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Automation</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Failed</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run) => (
                  <tr key={run.id} className="border-t border-slate-100">
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
          )}
        </div>
      </section>
    </div>
  );
}
