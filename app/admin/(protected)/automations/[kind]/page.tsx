"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Play, RefreshCw, RotateCcw, Users } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/pagination";
import {
  AutomationDetailSkeleton,
  TableRowSkeleton,
} from "@/components/admin/skeleton";
import { LeadFilterBar } from "@/components/admin/lead-filter-bar";
import { clearAdminFetchCache, fetchAdminJson } from "@/components/admin/fetch-json";
import { invalidateLeadsCache, useAllLeads } from "@/components/admin/use-all-leads";
import {
  sendAutomationBatches,
  type SendAction,
} from "@/components/admin/send-automation-batches";
import {
  EMPTY_SEND_PROGRESS,
  SendProgressModal,
  type SendProgressState,
} from "@/components/admin/send-progress-modal";
import {
  EMPTY_SEND_CONFIRM,
  SendConfirmModal,
  type SendConfirmState,
} from "@/components/admin/send-confirm-modal";
import { SortableTh, TableSortSelect } from "@/components/admin/sortable-th";
import {
  emptyTableSort,
  dateSortValue,
  nextTableSort,
  sortRows,
  statusSortValue,
  type TableSortState,
} from "@/lib/admin/table-sort";
import {
  EMPTY_LEAD_FILTERS,
  kindMatchesStatus,
  leadChannelStatus,
  matchesLeadFilters,
  uniqueColleges,
  uniqueQualifications,
  type LeadFilters,
} from "@/lib/admin/lead-filters";
import type {
  AutomationKind,
  AutomationOverview,
  AutomationRun,
  MessageStatus,
} from "@/lib/automations/types";
import type { StoredRegistration } from "@/lib/firebase/registration-types";

interface KindResponse {
  ok: boolean;
  error?: string;
  automation?: AutomationOverview;
  templateName?: string;
  recentRuns?: AutomationRun[];
}

function isDelivered(status: MessageStatus) {
  return status === "sent" || status === "legacy" || status === "skipped";
}

type LeadSortKey =
  | "name"
  | "phone"
  | "email"
  | "qualification"
  | "whatsapp"
  | "emailStatus";

type RunSortKey = "when" | "by" | "sent" | "failed" | "skipped";

const LEAD_SORT_OPTIONS: { key: LeadSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "qualification", label: "Qualification" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "emailStatus", label: "Email status" },
];

const RUN_SORT_OPTIONS: { key: RunSortKey; label: string }[] = [
  { key: "when", label: "When" },
  { key: "by", label: "By" },
  { key: "sent", label: "Sent" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
];

export default function AutomationDetailPage() {
  const params = useParams<{ kind: string }>();
  const kind = params.kind as AutomationKind;
  const [meta, setMeta] = useState<KindResponse | null>(null);
  const [metaError, setMetaError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<SendProgressState>(EMPTY_SEND_PROGRESS);
  const [confirm, setConfirm] = useState<SendConfirmState>(EMPTY_SEND_CONFIRM);
  const [pendingSend, setPendingSend] = useState<{
    action: SendAction;
    ids: string[];
    title: string;
  } | null>(null);
  const [leadSort, setLeadSort] = useState<TableSortState<LeadSortKey>>(emptyTableSort());
  const [runSort, setRunSort] = useState<TableSortState<RunSortKey>>(emptyTableSort());
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const mobileHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const { leads, loading: leadsLoading, error: leadsError, reload } = useAllLeads();

  const loadMeta = useCallback(
    async (fresh = false) => {
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
    },
    [kind],
  );

  useEffect(() => {
    void loadMeta().catch(() => setMetaError("Could not load this automation."));
  }, [loadMeta]);

  useEffect(() => {
    setFilters(EMPTY_LEAD_FILTERS);
    setSelected(new Set());
    setPage(1);
  }, [kind]);

  const colleges = useMemo(() => uniqueColleges(leads), [leads]);
  const qualifications = useMemo(() => uniqueQualifications(leads), [leads]);
  const filtered = useMemo(
    () => leads.filter((reg) => matchesLeadFilters(reg, filters, kind)),
    [leads, filters, kind],
  );
  const sorted = useMemo(
    () =>
      sortRows(filtered, leadSort, (reg, key) => {
        if (key === "name") return reg.fullName;
        if (key === "phone") return reg.phone;
        if (key === "email") return reg.email;
        if (key === "qualification") return reg.qualification;
        if (key === "whatsapp") {
          return statusSortValue(leadChannelStatus(reg, kind, "whatsapp"));
        }
        return statusSortValue(leadChannelStatus(reg, kind, "email"));
      }),
    [filtered, leadSort, kind],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageItems.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const allPageSelected =
    pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, leadSort]);

  useEffect(() => {
    [headerCheckboxRef, mobileHeaderCheckboxRef].forEach((ref) => {
      if (ref.current) ref.current.indeterminate = somePageSelected;
    });
  }, [somePageSelected]);

  function pool(): StoredRegistration[] {
    if (selected.size > 0) return leads.filter((r) => selected.has(r.id));
    return filtered;
  }

  function idsFor(mode: "pending" | "failed" | "all") {
    const source = pool();
    if (mode === "pending") {
      return source
        .filter((r) => kindMatchesStatus(r, kind, "pending"))
        .map((r) => r.id);
    }
    if (mode === "failed") {
      return source
        .filter((r) => kindMatchesStatus(r, kind, "failed"))
        .map((r) => r.id);
    }
    return source.map((r) => r.id);
  }

  function requestSend(opts: {
    action: SendAction;
    ids: string[];
    title: string;
    body: string;
  }) {
    if (opts.ids.length === 0) {
      window.alert("No leads match this action with the current selection or filters.");
      return;
    }
    setPendingSend({ action: opts.action, ids: opts.ids, title: opts.title });
    setConfirm({
      open: true,
      title: opts.title,
      body: opts.body,
      count: opts.ids.length,
      supportsEmail: Boolean(meta?.automation?.channels.includes("email")),
    });
  }

  async function executeSend(includeEmail: boolean) {
    if (!pendingSend) return;
    const opts = pendingSend;
    setPendingSend(null);
    setConfirm(EMPTY_SEND_CONFIRM);
    setBusy(true);
    setNotice("");
    try {
      const result = await sendAutomationBatches({
        kind,
        ids: opts.ids,
        action: opts.action,
        title: opts.title,
        includeEmail,
        onProgress: setProgress,
      });
      if (!result.error) {
        setNotice(
          `Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}.`,
        );
      }
      invalidateLeadsCache();
      clearAdminFetchCache("/api/admin/automations");
      await Promise.all([loadMeta(true), reload(true)]);
      setSelected(new Set());
    } catch {
      setMetaError("Send failed.");
      setProgress((prev) => ({
        ...prev,
        open: true,
        error: "Send failed.",
        done: true,
      }));
    } finally {
      setBusy(false);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const goToPage = (n: number) => {
    setPage(n);
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
  const colCount = showEmail ? 9 : 8;
  const usingSelection = selected.size > 0;
  const pendingCount = idsFor("pending").length;
  const failedCount = idsFor("failed").length;
  const allCount = idsFor("all").length;
  const allLeadIds = leads.map((r) => r.id);
  const allPendingCount = leads.filter((r) =>
    kindMatchesStatus(r, kind, "pending"),
  ).length;
  const sortedRuns = sortRows(meta.recentRuns ?? [], runSort, (run, key) => {
    if (key === "when") return dateSortValue(run.startedAt);
    if (key === "by") return run.triggeredBy;
    if (key === "sent") return run.stats.sent;
    if (key === "failed") return run.stats.failed;
    return run.stats.skipped;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">{item.title}</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">{item.scheduleLabel}</p>
          {meta.templateName ? (
            <p className="mt-1 break-all text-xs text-faint">WhatsApp template: {meta.templateName}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <a
            href={`/api/admin/automations/${kind}/export`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" />
            Download report
          </a>
          <button
            type="button"
            disabled={busy || failedCount === 0}
            onClick={() =>
              requestSend({
                action: "retry_failed",
                ids: idsFor("failed"),
                title: `Retrying failed ${item.title} messages`,
                body: usingSelection
                  ? `Retry failed sends for ${failedCount} selected lead${failedCount === 1 ? "" : "s"}?`
                  : `Retry failed sends for ${failedCount} lead${failedCount === 1 ? "" : "s"} matching the current filters?`,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Retry failed
          </button>
          <button
            type="button"
            disabled={busy || allCount === 0}
            onClick={() =>
              requestSend({
                action: "resend",
                ids: idsFor("all"),
                title: `Resending ${item.title}`,
                body: usingSelection
                  ? `Resend to ${allCount} selected lead${allCount === 1 ? "" : "s"}, including people who already received it?`
                  : `Resend to all ${allCount} lead${allCount === 1 ? "" : "s"} matching the current filters, including people who already received it?`,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Resend
          </button>
          <button
            type="button"
            disabled={busy || allLeadIds.length === 0}
            onClick={() =>
              requestSend({
                action: "run",
                ids: allLeadIds,
                title: `Sending ${item.title} to all leads`,
                body: `Send “${item.title}” to all ${allLeadIds.length} registered lead${allLeadIds.length === 1 ? "" : "s"}? This ignores filters and checkboxes. ${allPendingCount} ${allPendingCount === 1 ? "is" : "are"} still pending; people who already received it will be skipped. Messages go out in batches of 40.`,
              })
            }
            className="btn-gradient px-5 py-2 text-sm disabled:opacity-60 sm:col-span-2 lg:col-span-1"
          >
            <Users className="h-4 w-4" />
            {busy ? "Sending…" : `Send to all (${allLeadIds.length})`}
          </button>
          <button
            type="button"
            disabled={busy || (usingSelection ? selected.size === 0 : pendingCount === 0)}
            onClick={() =>
              requestSend({
                action: "run",
                ids: usingSelection ? [...selected] : idsFor("pending"),
                title: `Sending ${item.title}`,
                body: usingSelection
                  ? `Send to ${selected.size} selected lead${selected.size === 1 ? "" : "s"}? Already-delivered copies will be skipped.`
                  : `Send to ${pendingCount} pending lead${pendingCount === 1 ? "" : "s"} matching the current filters? Messages go out in batches of 40.`,
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            {busy ? "Sending…" : usingSelection ? "Send selected" : "Send pending"}
          </button>
        </div>
      </div>

      {notice ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
      ) : null}
      {metaError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{metaError}</p>
      ) : null}
      {leadsError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{leadsError}</p>
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

      <LeadFilterBar
        filters={filters}
        colleges={colleges}
        qualifications={qualifications}
        lockedKind={kind}
        resultCount={filtered.length}
        totalCount={leads.length}
        onChange={setFilters}
      />

      <TableSortSelect
        options={
          showEmail
            ? LEAD_SORT_OPTIONS
            : LEAD_SORT_OPTIONS.filter((o) => o.key !== "emailStatus")
        }
        sort={leadSort}
        onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
        onClear={() => setLeadSort(emptyTableSort())}
      />

      {allPageSelected && filtered.length > pageItems.length ? (
        <div className="rounded-2xl bg-sky-50 px-4 py-2 text-sm">
          All {pageItems.length} on this page are selected.{" "}
          <button
            type="button"
            className="font-semibold text-brand-blue hover:underline"
            onClick={() => setSelected(new Set(filtered.map((r) => r.id)))}
          >
            Select all {filtered.length} matching filters
          </button>
        </div>
      ) : null}

      <div className="space-y-3 md:hidden">
        <label className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium shadow-card">
          <input
            ref={mobileHeaderCheckboxRef}
            type="checkbox"
            checked={allPageSelected}
            onChange={togglePage}
            disabled={pageItems.length === 0 || busy}
            className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
          />
          Select this page
        </label>
        {leadsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white shadow-card" />
            ))
          : pageItems.map((r, i) => {
              const waStatus = leadChannelStatus(r, kind, "whatsapp");
              const emailStatus = leadChannelStatus(r, kind, "email");
              const delivered = isDelivered(waStatus);
              const serial = (safePage - 1) * pageSize + i + 1;
              return (
                <article key={r.id} className="rounded-2xl bg-white p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      disabled={busy}
                      aria-label={`Select ${r.fullName}`}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-bold">
                        <span className="mr-1.5 tabular-nums text-muted">{serial}.</span>
                        {r.fullName}
                      </h3>
                      <p className="mt-1 break-all text-sm">{r.email}</p>
                      <p className="mt-0.5 text-sm text-muted">{r.phone}</p>
                      <p className="mt-2 text-sm">
                        {r.qualification || "—"}
                        {r.college ? ` · ${r.college}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge status={waStatus} />
                        {showEmail ? <StatusBadge status={emailStatus} /> : null}
                      </div>
                      {r.messages?.[kind]?.whatsapp?.error ? (
                        <p className="mt-2 text-xs text-red-600">{r.messages[kind]?.whatsapp?.error}</p>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          requestSend({
                            action: delivered ? "resend" : "run",
                            ids: [r.id],
                            title: delivered
                              ? `Resending ${item.title}`
                              : `Sending ${item.title}`,
                            body: delivered
                              ? `Resend this message to ${r.fullName}? They already have a delivery on file.`
                              : `Send this message to ${r.fullName} now?`,
                          })
                        }
                        className="mt-3 text-sm font-semibold text-brand-blue hover:underline disabled:opacity-50"
                      >
                        {delivered ? "Resend" : "Send"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
      </div>

      <section className="hidden overflow-hidden rounded-2xl bg-white shadow-card md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">S.No</th>
                <th className="w-10 px-4 py-3">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    disabled={pageItems.length === 0 || busy}
                    aria-label="Select all leads on this page"
                    className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                  />
                </th>
                <SortableTh
                  label="Name"
                  column="name"
                  sort={leadSort}
                  onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
                />
                <SortableTh
                  label="Phone"
                  column="phone"
                  sort={leadSort}
                  onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
                />
                <SortableTh
                  label="Email"
                  column="email"
                  sort={leadSort}
                  onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
                />
                <SortableTh
                  label="Qualification"
                  column="qualification"
                  sort={leadSort}
                  onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
                />
                <SortableTh
                  label="WhatsApp"
                  column="whatsapp"
                  sort={leadSort}
                  onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
                />
                {showEmail ? (
                  <SortableTh
                    label="Email status"
                    column="emailStatus"
                    sort={leadSort}
                    onSort={(column) => setLeadSort((prev) => nextTableSort(prev, column))}
                  />
                ) : null}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {leadsLoading
                ? Array.from({ length: pageSize }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={colCount} />
                  ))
                : pageItems.map((r, i) => {
                    const waStatus = leadChannelStatus(r, kind, "whatsapp");
                    const emailStatus = leadChannelStatus(r, kind, "email");
                    const delivered = isDelivered(waStatus);
                    return (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                          {(safePage - 1) * pageSize + i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleOne(r.id)}
                            disabled={busy}
                            aria-label={`Select ${r.fullName}`}
                            className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">{r.fullName}</td>
                        <td className="whitespace-nowrap px-4 py-3">{r.phone}</td>
                        <td className="px-4 py-3">{r.email}</td>
                        <td className="whitespace-nowrap px-4 py-3">{r.qualification || "—"}</td>
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
                              requestSend({
                                action: delivered ? "resend" : "run",
                                ids: [r.id],
                                title: delivered
                                  ? `Resending ${item.title}`
                                  : `Sending ${item.title}`,
                                body: delivered
                                  ? `Resend this message to ${r.fullName}? They already have a delivery on file.`
                                  : `Send this message to ${r.fullName} now?`,
                              })
                            }
                            className="text-sm font-semibold text-brand-blue hover:underline disabled:opacity-50"
                          >
                            {delivered ? "Resend" : "Send"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!leadsLoading && filtered.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-muted">
            No leads match these filters.
          </p>
        ) : null}
      </section>

      {!leadsLoading && filtered.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-muted shadow-card md:hidden">
          No leads match these filters.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <AdminPagination
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          hasNext={safePage < totalPages}
          disabled={leadsLoading}
          onPageChange={goToPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {selected.size > 0 ? (
        <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-white shadow-card-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">
            {selected.size} selected
            {selected.size !== filtered.length ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
                  onClick={() => setSelected(new Set(filtered.map((r) => r.id)))}
                >
                  Select all {filtered.length} matching filters
                </button>
              </>
            ) : null}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(new Set())}
              className="rounded-full px-3 py-1.5 text-sm text-white/80 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                requestSend({
                  action: "resend",
                  ids: [...selected],
                  title: `Resending ${item.title}`,
                  body: `Resend to ${selected.size} selected lead${selected.size === 1 ? "" : "s"}?`,
                })
              }
              className="rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold"
            >
              Resend selected
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                requestSend({
                  action: "run",
                  ids: [...selected],
                  title: `Sending ${item.title}`,
                  body: `Send to ${selected.size} selected lead${selected.size === 1 ? "" : "s"}? Already-delivered copies will be skipped.`,
                })
              }
              className="col-span-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-navy-900 sm:col-span-1"
            >
              Send selected
            </button>
          </div>
        </div>
      ) : null}

      {meta.recentRuns && meta.recentRuns.length > 0 ? (
        <section>
          <h2 className="mb-3 font-heading text-lg font-bold">Run history</h2>
          <TableSortSelect
            options={RUN_SORT_OPTIONS}
            sort={runSort}
            onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
            onClear={() => setRunSort(emptyTableSort())}
          />
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="overflow-x-auto">
            <table className="min-w-[520px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">S.No</th>
                  <SortableTh
                    label="When"
                    column="when"
                    sort={runSort}
                    onSort={(column) => setRunSort((prev) => nextTableSort(prev, column))}
                  />
                  <SortableTh
                    label="By"
                    column="by"
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
                    label="Skipped"
                    column="skipped"
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
          </div>
        </section>
      ) : null}

      <SendConfirmModal
        confirm={confirm}
        onCancel={() => {
          setPendingSend(null);
          setConfirm(EMPTY_SEND_CONFIRM);
        }}
        onConfirm={(includeEmail) => void executeSend(includeEmail)}
      />
      <SendProgressModal
        progress={progress}
        onClose={() => setProgress(EMPTY_SEND_PROGRESS)}
      />
    </div>
  );
}
