"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/pagination";
import { LeadsPageSkeleton, TableRowSkeleton } from "@/components/admin/skeleton";
import { LeadFilterBar } from "@/components/admin/lead-filter-bar";
import { SortableTh, TableSortSelect } from "@/components/admin/sortable-th";
import { useAllLeads } from "@/components/admin/use-all-leads";
import {
  EMPTY_LEAD_FILTERS,
  leadChannelStatus,
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
import type { StoredRegistration } from "@/lib/firebase/registration-types";

type LeadSortKey =
  | "name"
  | "email"
  | "phone"
  | "college"
  | "qualification"
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
  { key: "registered", label: "Registered" },
  { key: "welcome", label: "Welcome" },
  { key: "carry", label: "Carry" },
  { key: "reminder21", label: "21 Aug" },
  { key: "reminder22", label: "22 Aug" },
];

const KIND_SHORT = {
  welcome: "Welcome",
  things_to_carry: "Carry",
  reminder_day_before: "21 Aug",
  reminder_event_day: "22 Aug",
} as const;

function leadSortValue(reg: StoredRegistration, key: LeadSortKey): unknown {
  if (key === "name") return reg.fullName;
  if (key === "email") return reg.email;
  if (key === "phone") return reg.phone;
  if (key === "college") return reg.college;
  if (key === "qualification") return reg.qualification;
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
  const { leads, loading, error } = useAllLeads();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<TableSortState<LeadSortKey>>(emptyTableSort());

  const colleges = useMemo(() => uniqueColleges(leads), [leads]);
  const qualifications = useMemo(() => uniqueQualifications(leads), [leads]);
  const filtered = useMemo(
    () => leads.filter((reg) => matchesLeadFilters(reg, filters)),
    [leads, filters],
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
    document.querySelector("main")?.scrollTo({ top: 0 });
  }

  if (loading && leads.length === 0) {
    return <LeadsPageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">Leads</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">
            {leads.length} registered candidate{leads.length === 1 ? "" : "s"}
          </p>
        </div>
        <a
          href="/api/admin/leads/export"
          className="hidden items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white md:inline-flex"
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
              href="/api/admin/leads/export"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </a>
          </div>
        }
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-white shadow-card" />
            ))
          : pageItems.map((r, i) => (
              <LeadMobileCard
                key={r.id}
                lead={r}
                serial={(safePage - 1) * pageSize + i + 1}
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
            hasNext={safePage < totalPages}
            disabled={loading}
            onPageChange={handlePageChange}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-card md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-sm">
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
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 25) }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={11} />
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
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {registeredLabel(r)}
                      </td>
                      {AUTOMATION_KINDS.map((kind) => (
                        <td key={kind} className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={leadChannelStatus(r, kind, "whatsapp")} />
                            {kind === "welcome" || kind === "reminder_day_before" ? (
                              <StatusBadge status={leadChannelStatus(r, kind, "email")} />
                            ) : null}
                          </div>
                        </td>
                      ))}
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
          hasNext={safePage < totalPages}
          disabled={loading}
          onPageChange={handlePageChange}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}

function LeadMobileCard({
  lead,
  serial,
}: {
  lead: StoredRegistration;
  serial: number;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-sm tabular-nums text-muted">{serial}.</span>
        <h2 className="font-heading text-base font-bold text-navy-900">{lead.fullName}</h2>
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
              <StatusBadge status={leadChannelStatus(lead, kind, "whatsapp")} />
              {kind === "welcome" || kind === "reminder_day_before" ? (
                <StatusBadge status={leadChannelStatus(lead, kind, "email")} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
