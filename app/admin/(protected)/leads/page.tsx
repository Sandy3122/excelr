"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPagination } from "@/components/admin/pagination";
import { LeadsPageSkeleton, TableRowSkeleton } from "@/components/admin/skeleton";
import { useCursorPagination } from "@/components/admin/use-cursor-pagination";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import { AUTOMATION_KINDS } from "@/lib/automations/types";

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  nextCursor: string | null;
  total?: number;
}

function channelStatus(reg: StoredRegistration, kind: string, channel: string) {
  const status = reg.messages?.[kind as keyof NonNullable<typeof reg.messages>]?.[
    channel as "whatsapp" | "email"
  ]?.status;
  if (status) return status;
  return kind === "welcome" ? "legacy" : "pending";
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
    total: json.total ?? json.registrations.length,
  };
}

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
  const [q, setQ] = useState("");
  const pager = useCursorPagination<StoredRegistration>(fetchLeadsPage, 25);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pager.items;
    return pager.items.filter((r) =>
      [r.fullName, r.email, r.phone, r.college, r.qualification]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [pager.items, q]);

  function handlePageChange(n: number) {
    pager.goToPage(n);
    document.querySelector("main")?.scrollTo({ top: 0 });
  }

  if (pager.loading && pager.items.length === 0) {
    return <LeadsPageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-900">Leads</h1>
          <p className="mt-1 text-muted">
            {pager.total} registered candidate{pager.total === 1 ? "" : "s"}
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

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search this page by name, email, phone, or college…"
          className="field-input pl-10"
        />
      </label>

      {pager.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{pager.error}</p>
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
              {pager.loading
                ? Array.from({ length: Math.min(pager.pageSize, 25) }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={9} />
                  ))
                : filtered.map((r) => (
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
                            <StatusBadge status={channelStatus(r, kind, "whatsapp")} />
                            {kind === "welcome" || kind === "reminder_day_before" ? (
                              <StatusBadge status={channelStatus(r, kind, "email")} />
                            ) : null}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!pager.loading && filtered.length === 0 ? (
          <p className="border-t border-slate-100 p-4 text-sm text-muted">
            No leads match this view.
          </p>
        ) : null}
        <AdminPagination
          page={pager.page}
          pageSize={pager.pageSize}
          total={pager.total}
          hasNext={pager.hasNext}
          disabled={pager.loading}
          onPageChange={handlePageChange}
          onPageSizeChange={pager.changePageSize}
        />
      </div>
    </div>
  );
}
