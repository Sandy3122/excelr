"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/pagination";
import { LeadsPageSkeleton, TableRowSkeleton } from "@/components/admin/skeleton";
import { LeadFilterBar } from "@/components/admin/lead-filter-bar";
import { useAllLeads } from "@/components/admin/use-all-leads";
import {
  EMPTY_LEAD_FILTERS,
  leadChannelStatus,
  matchesLeadFilters,
  uniqueColleges,
  type LeadFilters,
} from "@/lib/admin/lead-filters";
import { AUTOMATION_KINDS } from "@/lib/automations/types";

const TABLE_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "College",
  "Registered",
  "Welcome",
  "Carry",
  "21 Aug",
  "22 Aug",
];

export default function AdminLeadsPage() {
  const { leads, loading, error } = useAllLeads();
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_LEAD_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const colleges = useMemo(() => uniqueColleges(leads), [leads]);
  const filtered = useMemo(
    () => leads.filter((reg) => matchesLeadFilters(reg, filters)),
    [leads, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  function handleFilters(next: LeadFilters) {
    setFilters(next);
  }

  function handlePageChange(n: number) {
    setPage(n);
    document.querySelector("main")?.scrollTo({ top: 0 });
  }

  if (loading && leads.length === 0) {
    return <LeadsPageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-900">Leads</h1>
          <p className="mt-1 text-muted">
            {leads.length} registered candidate{leads.length === 1 ? "" : "s"}
          </p>
        </div>
        <a
          href="/api/admin/leads/export"
          className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <Download className="h-4 w-4" />
          Download CSV
        </a>
      </div>

      <LeadFilterBar
        filters={filters}
        colleges={colleges}
        resultCount={filtered.length}
        totalCount={leads.length}
        onChange={handleFilters}
      />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                {TABLE_HEADERS.map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: Math.min(pageSize, 25) }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={9} />
                  ))
                : pageItems.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{r.fullName}</td>
                      <td className="px-4 py-3">{r.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.phone}</td>
                      <td className="px-4 py-3">{r.college}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {r.submittedAt || r.submittedAtIso
                          ? new Date(r.submittedAt || r.submittedAtIso).toLocaleString(
                              "en-IN",
                              { timeZone: "Asia/Kolkata" },
                            )
                          : "—"}
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
