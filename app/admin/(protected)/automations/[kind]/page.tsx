"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Play, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/pagination";
import {
  AutomationDetailSkeleton,
  TableRowSkeleton,
} from "@/components/admin/skeleton";
import { useCursorPagination } from "@/components/admin/use-cursor-pagination";
import { clearAdminFetchCache, fetchAdminJson } from "@/components/admin/fetch-json";
import type {
  AutomationKind,
  AutomationOverview,
  AutomationRun,
} from "@/lib/automations/types";
import type { StoredRegistration } from "@/lib/firebase/registration-types";

interface KindResponse {
  ok: boolean;
  error?: string;
  automation?: AutomationOverview;
  templateName?: string;
  recentRuns?: AutomationRun[];
}

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  nextCursor: string | null;
  total?: number;
}

async function fetchLeadsPage(cursor: string | undefined, pageSize: number) {
  const params = new URLSearchParams({ limit: String(pageSize) });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/admin/leads?${params.toString()}`);
  const json = (await res.json()) as LeadsResponse;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Could not load leads.");
  }
  return {
    items: json.registrations,
    nextCursor: json.nextCursor,
    total: json.total,
  };
}

export default function AutomationDetailPage() {
  const params = useParams<{ kind: string }>();
  const kind = params.kind as AutomationKind;
  const [meta, setMeta] = useState<KindResponse | null>(null);
  const [metaError, setMetaError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const pager = useCursorPagination<StoredRegistration>(fetchLeadsPage, 25);

  const loadMeta = useCallback(async (fresh = false) => {
    setMetaError("");
    const url = fresh
      ? `/api/admin/automations/${kind}?fresh=1`
      : `/api/admin/automations/${kind}`;
    const json = await fetchAdminJson<KindResponse>(url, { fresh });
    if (!json.ok) {
      setMetaError(json.error || "Could not load this automation.");
      return;
    }
    setMeta(json);
  }, [kind]);

  useEffect(() => {
    void loadMeta().catch(() => setMetaError("Could not load this automation."));
  }, [loadMeta]);

  async function runSend(opts: {
    force?: boolean;
    retryFailed?: boolean;
    registrationId?: string;
  }) {
    const label = opts.registrationId
      ? "Send this message now? Already-delivered copies will be skipped."
      : opts.retryFailed
        ? "Retry every failed send for this automation?"
        : "Send this automation to everyone who has not received it yet? This can message hundreds of candidates in batches.";
    if (!window.confirm(label)) return;
    setBusy(true);
    setNotice("");
    try {
      let keepGoing = true;
      let lastNotice = "";
      while (keepGoing) {
        const res = await fetch(`/api/admin/automations/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: opts.retryFailed ? "retry_failed" : "run",
            force: opts.force ?? true,
            registrationId: opts.registrationId,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          error?: string;
          run?: AutomationRun;
        };
        if (!res.ok || !json.ok || !json.run) {
          setMetaError(json.error || "Send failed.");
          break;
        }
        lastNotice = `Sent ${json.run.stats.sent}, failed ${json.run.stats.failed}, skipped ${json.run.stats.skipped}.`;
        keepGoing = json.run.status === "running" && !opts.registrationId;
      }
      setNotice(lastNotice);
      clearAdminFetchCache("/api/admin/automations");
      await Promise.all([loadMeta(true), Promise.resolve(pager.reload())]);
    } catch {
      setMetaError("Send failed.");
    } finally {
      setBusy(false);
    }
  }

  const goToPage = (n: number) => {
    pager.goToPage(n);
    document.querySelector("main")?.scrollTo({ top: 0 });
  };

  if (metaError && !meta) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{metaError}</p>
      </div>
    );
  }
  if (!meta?.automation) {
    return <AutomationDetailSkeleton />;
  }

  const item = meta.automation;
  const wa = item.counts.whatsapp;
  const email = item.counts.email;
  const showEmail = item.channels.includes("email");
  const colCount = showEmail ? 6 : 5;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-900">{item.title}</h1>
          <p className="mt-1 text-muted">{item.scheduleLabel}</p>
          {meta.templateName ? (
            <p className="mt-1 text-xs text-faint">WhatsApp template: {meta.templateName}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/automations/${kind}/export`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" />
            Download report
          </a>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSend({ retryFailed: true, force: true })}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Retry failed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSend({ force: true })}
            className="btn-gradient px-5 py-2 text-sm disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {busy ? "Sending…" : "Send pending"}
          </button>
        </div>
      </div>

      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
      ) : null}
      {metaError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{metaError}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {wa ? (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="text-sm font-medium text-muted">WhatsApp</div>
            <div className="mt-2 text-sm">
              <strong>{wa.sent}</strong> sent · {wa.pending} pending · {wa.failed} failed ·{" "}
              {wa.skipped} skipped
            </div>
          </div>
        ) : null}
        {email ? (
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="text-sm font-medium text-muted">Email</div>
            <div className="mt-2 text-sm">
              <strong>{email.sent}</strong> sent · {email.pending} pending · {email.failed}{" "}
              failed · {email.skipped} skipped
            </div>
          </div>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">WhatsApp</th>
                {showEmail ? <th className="px-4 py-3">Email status</th> : null}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pager.loading
                ? Array.from({ length: pager.pageSize }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={colCount} />
                  ))
                : pager.items.map((r) => {
                    const waStatus =
                      r.messages?.[kind]?.whatsapp?.status ||
                      (kind === "welcome" ? "legacy" : "pending");
                    const emailStatus =
                      r.messages?.[kind]?.email?.status ||
                      (kind === "welcome" ? "legacy" : "pending");
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">{r.fullName}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.phone}</td>
                        <td className="px-4 py-3">{r.email}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={waStatus} />
                          {r.messages?.[kind]?.whatsapp?.error ? (
                            <div className="mt-1 max-w-xs truncate text-xs text-red-600">
                              {r.messages?.[kind]?.whatsapp?.error}
                            </div>
                          ) : null}
                        </td>
                        {showEmail ? (
                          <td className="px-4 py-3">
                            <StatusBadge status={emailStatus} />
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runSend({
                                force: true,
                                retryFailed: true,
                                registrationId: r.id,
                              })
                            }
                            className="text-sm font-semibold text-brand-blue hover:underline disabled:opacity-50"
                          >
                            Send
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!pager.loading && pager.items.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-muted">No leads yet.</p>
        ) : null}
        <AdminPagination
          page={pager.page}
          pageSize={pager.pageSize}
          total={pager.total}
          hasNext={pager.hasNext}
          disabled={pager.loading}
          onPageChange={goToPage}
          onPageSizeChange={pager.changePageSize}
        />
      </section>

      {meta.recentRuns && meta.recentRuns.length > 0 ? (
        <section>
          <h2 className="mb-3 font-heading text-lg font-bold">Run history</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Failed</th>
                  <th className="px-4 py-3">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {meta.recentRuns.map((run) => (
                  <tr key={run.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {run.startedAt
                        ? new Date(run.startedAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{run.triggeredBy}</td>
                    <td className="px-4 py-3">{run.stats.sent}</td>
                    <td className="px-4 py-3">{run.stats.failed}</td>
                    <td className="px-4 py-3">{run.stats.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
