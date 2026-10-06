"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { DeliveryBadge } from "@/components/admin/delivery-badge";
import { AdminPagination } from "@/components/admin/pagination";
import { LeadsPageSkeleton, TableRowSkeleton } from "@/components/admin/skeleton";
import { LeadFilterBar } from "@/components/admin/lead-filter-bar";
import { SortableTh, TableSortSelect } from "@/components/admin/sortable-th";
import { clearAdminFetchCache } from "@/components/admin/fetch-json";
import { invalidateLeadsCache } from "@/components/admin/use-all-leads";
import { useLeadBatches } from "@/components/admin/use-lead-batches";
import { useAdminDrive, withDrive } from "@/components/admin/drive-context";
import {
  EMPTY_LEAD_FILTERS,
  deliveriesForKind,
  leadChannelStatus,
  DEFAULT_AUTOMATION_VIEW,
  type DriveAutomationView,
  matchesLeadFilters,
  uniqueColleges,
  uniqueQualifications,
  type LeadFilters,
} from "@/lib/admin/lead-filters";
import {
  emptyTableSort,
  dateSortValue,
  nextTableSort,
  sortRows,
  statusSortValue,
  type TableSortState,
} from "@/lib/admin/table-sort";
import { AUTOMATION_KINDS } from "@/lib/automations/types";
import { distanceFromVenueKm, formatGeoLocation } from "@/lib/geo";
import type { StoredRegistration } from "@/lib/firebase/registration-types";

type LeadSortKey =
  | "name"
  | "email"
  | "phone"
  | "college"
  | "qualification"
  | "location"
  | "distance"
  | "registered"
  | "welcome"
  | "carry"
  | "reminder21"
  | "reminder22";

const LEAD_SORT_OPTIONS: { key: LeadSortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "college", label: "College" },
  { key: "qualification", label: "Qualification" },
  { key: "location", label: "Location" },
  { key: "distance", label: "Distance (km)" },
  { key: "registered", label: "Registered" },
  { key: "welcome", label: "Welcome" },
  { key: "carry", label: "Carry" },
  { key: "reminder21", label: "Day before" },
  { key: "reminder22", label: "Event day" },
];

/** Column headings. Dates belong to the drive, so the labels stay generic. */
const KIND_SHORT = {
  welcome: "Welcome",
  things_to_carry: "Carry",
  reminder_day_before: "Day before",
  reminder_event_day: "Event day",
} as const;

type LeadRow = StoredRegistration & { distanceKm: number | null };

function leadSortValue(reg: LeadRow, key: LeadSortKey): unknown {
  if (key === "name") return reg.fullName;
  if (key === "email") return reg.email;
  if (key === "phone") return reg.phone;
  if (key === "college") return reg.college;
  if (key === "qualification") return reg.qualification;
  if (key === "location") return formatGeoLocation(reg.geo ?? null) || null;
  if (key === "distance") return reg.distanceKm;
  if (key === "registered") return dateSortValue(reg.submittedAt || reg.submittedAtIso);
  if (key === "welcome") return statusSortValue(leadChannelStatus(reg, "welcome", "whatsapp"));
  if (key === "carry") {
    return statusSortValue(leadChannelStatus(reg, "things_to_carry", "whatsapp"));
  }
  if (key === "reminder21") {
    return statusSortValue(leadChannelStatus(reg, "reminder_day_before", "whatsapp"));
  }
  return statusSortValue(leadChannelStatus(reg, "reminder_event_day", "whatsapp"));
}

function registeredLabel(reg: StoredRegistration) {
  const raw = reg.submittedAt || reg.submittedAtIso;
  if (!raw) return "—";
  return new Date(raw).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export default function AdminLeadsPage() {
  const { driveId, drive } = useAdminDrive();
  const {
    leads: rawLeads,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
  } = useLeadBatches();
  const canDelete = drive?.allowLeadDeletion ?? false;
  const [toDelete, setToDelete] = useState<LeadRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(
        withDrive(`/api/admin/leads?id=${encodeURIComponent(toDelete.id)}`, driveId),
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setDeleteError(json.error || "Could not delete the lead.");
        return;
      }
      setToDelete(null);
      invalidateLeadsCache();
      // Overview counts are cached in the browser too.
      clearAdminFetchCache();
      await reload();
    } catch {
      setDeleteError("Could not delete the lead.");
    } finally {
      setDeleting(false);
    }
  }
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<TableSortState<LeadSortKey>>(emptyTableSort());

  // Which channels each automation uses comes from the selected drive, so a
  // campaign with email switched off never renders an email badge.
  const automationView = drive?.automations ?? DEFAULT_AUTOMATION_VIEW;

  // Distance depends on the selected drive's venue, so it is derived here
  // rather than stored on each lead.
  const leads: LeadRow[] = useMemo(
    () =>
      rawLeads.map((l) => ({
        ...l,
        distanceKm: distanceFromVenueKm(l.geo ?? null, drive),
      })),
    [rawLeads, drive],
  );

  const colleges = useMemo(() => uniqueColleges(leads), [leads]);
  const qualifications = useMemo(() => uniqueQualifications(leads), [leads]);
  const filtered = useMemo(
    () => leads.filter((reg) => matchesLeadFilters(reg, filters, automationView)),
    [leads, filters, automationView],
  );
  const sorted = useMemo(
    () => sortRows(filtered, sort, leadSortValue),
    [filtered, sort],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, sort]);

  function handlePageChange(n: number) {
    setPage(n);
    // Reaching the end of what is loaded fetches the next batch from the server.
    if (hasMore && n >= totalPages) void loadMore();
    document.querySelector("main")?.scrollTo({ top: 0 });
  }

  if (loading && leads.length === 0) {
    return <LeadsPageSkeleton />;
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Leads</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            {total} registered candidate{total === 1 ? "" : "s"}
            {hasMore ? ` · ${leads.length} loaded` : ""}
          </p>
        </div>
        <a
          href={withDrive("/api/admin/leads/export", driveId)}
          className="hidden items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white lg:inline-flex"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </div>

      <LeadFilterBar
        filters={filters}
        colleges={colleges}
        qualifications={qualifications}
        resultCount={filtered.length}
        totalCount={leads.length}
        onChange={setFilters}
        extra={
          <div className="space-y-3">
            <TableSortSelect
              options={LEAD_SORT_OPTIONS}
              sort={sort}
              onSort={(column) => setSort((prev) => nextTableSort(prev, column))}
              onClear={() => setSort(emptyTableSort())}
            />
            <a
              href={withDrive("/api/admin/leads/export", driveId)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </a>
          </div>
        }
      />

      {hasMore ? (
        <p className="rounded-xl bg-slate-50 px-4 py-2 text-xs text-muted">
          Showing the {leads.length} most recent of {total} leads. Search, filters and
          sorting apply to the loaded leads; more load automatically as you go to the
          last page.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="space-y-3 lg:hidden">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white shadow-card" />
            ))
          : pageItems.map((r, i) => (
              <LeadMobileCard
                key={r.id}
                lead={r}
                serial={(safePage - 1) * pageSize + i + 1}
                automationView={automationView}
                onDelete={canDelete ? () => setToDelete(r) : undefined}
              />
            ))}
        {!loading && filtered.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-muted shadow-card">
            No leads match these filters.
          </p>
        ) : null}
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <AdminPagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            hasNext={safePage < totalPages || hasMore}
            disabled={loading || loadingMore}
            onPageChange={handlePageChange}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      <div className="hidden min-w-0 overflow-hidden rounded-2xl bg-white shadow-card lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">S.No</th>
                {LEAD_SORT_OPTIONS.map((col) => (
                  <SortableTh
                    key={col.key}
                    label={col.label}
                    column={col.key}
                    sort={sort}
                    onSort={(column) => setSort((prev) => nextTableSort(prev, column))}
                  />
                ))}
                {canDelete ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 25) }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={canDelete ? 14 : 13} />
                  ))
                : pageItems.map((r, i) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">
                        {(safePage - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium">{r.fullName}</td>
                      <td className="px-4 py-3">{r.email}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.phone}</td>
                      <td className="px-4 py-3">{r.college}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.qualification || "—"}</td>
                      <td className="px-4 py-3">
                        {formatGeoLocation(r.geo ?? null) || "—"}
                        {r.geo ? (
                          <span
                            className={`ml-1.5 rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${
                              r.geo.source === "device"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                            title={
                              r.geo.source === "device"
                                ? "GPS location allowed by the user"
                                : "Approximate, from IP address"
                            }
                          >
                            {r.geo.source === "device" ? "GPS" : "IP"}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                        {r.distanceKm != null ? `${r.distanceKm} km` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {registeredLabel(r)}
                      </td>
                      {AUTOMATION_KINDS.map((kind) => (
                        <td key={kind} className="px-4 py-3">
                          <DeliveryBadge
                            enabled={automationView[kind]?.enabled ?? true}
                            entries={deliveriesForKind(r, kind, automationView)}
                          />
                        </td>
                      ))}
                      {canDelete ? (
                        <td className="px-4 py-3">
                          <DeleteLeadButton onClick={() => setToDelete(r)} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-muted">
            No leads match these filters.
          </p>
        ) : null}
        <AdminPagination
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          hasNext={safePage < totalPages || hasMore}
          disabled={loading || loadingMore}
          onPageChange={handlePageChange}
          onPageSizeChange={setPageSize}
        />
      </div>

      {toDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-lead-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg sm:p-6">
            <h2 id="delete-lead-title" className="font-heading text-lg font-bold text-red-700">
              Delete this lead permanently?
            </h2>
            <p className="mt-2 text-sm text-muted">
              This removes the registration from the database and cannot be undone.
              The same phone number and email will be able to register again.
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-ink">{toDelete.fullName}</p>
              <p className="break-all text-muted">{toDelete.email}</p>
              <p className="text-muted">{toDelete.phone}</p>
            </div>
            {deleteError ? (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setToDelete(null);
                  setDeleteError("");
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-navy-900 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeleteLeadButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Delete lead"
      title="Delete lead"
      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </button>
  );
}

function LeadMobileCard({
  lead,
  serial,
  automationView,
  onDelete,
}: {
  lead: LeadRow;
  serial: number;
  automationView: DriveAutomationView;
  onDelete?: () => void;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-sm tabular-nums text-muted">{serial}.</span>
        <h2 className="min-w-0 flex-1 font-heading text-base font-bold text-navy-900">
          {lead.fullName}
        </h2>
        {onDelete ? <DeleteLeadButton onClick={onDelete} /> : null}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Email</dt>
          <dd className="break-all">{lead.email}</dd>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-faint">Phone</dt>
            <dd>{lead.phone}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-faint">Qualification</dt>
            <dd>{lead.qualification || "—"}</dd>
          </div>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">College</dt>
          <dd>{lead.college || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Location</dt>
          <dd>
            {formatGeoLocation(lead.geo ?? null) || "—"}
            {lead.geo ? ` (${lead.geo.source === "device" ? "GPS" : "approx. IP"})` : ""}
            {lead.distanceKm != null ? ` · ~${lead.distanceKm} km from venue` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Registered</dt>
          <dd className="text-muted">{registeredLabel(lead)}</dd>
        </div>
      </dl>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {AUTOMATION_KINDS.map((kind) => (
          <div key={kind} className="rounded-xl bg-slate-50 px-2.5 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {KIND_SHORT[kind]}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <DeliveryBadge
                enabled={automationView[kind]?.enabled ?? true}
                entries={deliveriesForKind(lead, kind, automationView)}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
