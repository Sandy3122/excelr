"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import { AUTOMATION_KINDS } from "@/lib/automations/types";

interface LeadsResponse {
  ok: boolean;
  error?: string;
  registrations: StoredRegistration[];
  nextCursor: string | null;
}

function channelStatus(reg: StoredRegistration, kind: string, channel: string) {
  const status = reg.messages?.[kind as keyof NonNullable<typeof reg.messages>]?.[
    channel as "whatsapp" | "email"
  ]?.status;
  if (status) return status;
  return kind === "welcome" ? "legacy" : "pending";
}

export default function AdminLeadsPage() {
  const [rows, setRows] = useState<StoredRegistration[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async (next?: string | null, append = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (next) params.set("cursor", next);
      const res = await fetch(`/api/admin/leads?${params.toString()}`);
      const json = (await res.json()) as LeadsResponse;
      if (!res.ok || !json.ok) {
        setError(json.error || "Could not load leads.");
        return;
      }
      setRows((prev) => (append ? [...prev, ...json.registrations] : json.registrations));
      setCursor(json.nextCursor);
    } catch {
      setError("Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.fullName, r.email, r.phone, r.college, r.qualification]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-900">Leads</h1>
          <p className="mt-1 text-muted">
            {rows.length} loaded{cursor ? " (more available)" : ""}
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
          placeholder="Search name, email, phone, college…"
          className="field-input pl-10"
        />
      </label>

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">College</th>
              <th className="px-4 py-3">Registered</th>
              <th className="px-4 py-3">Welcome</th>
              <th className="px-4 py-3">Carry</th>
              <th className="px-4 py-3">21 Aug</th>
              <th className="px-4 py-3">22 Aug</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{r.fullName}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.phone}</td>
                <td className="px-4 py-3">{r.college}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {(r.submittedAt || r.submittedAtIso)
                    ? new Date(r.submittedAt || r.submittedAtIso).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })
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
        {loading ? <p className="p-4 text-sm text-muted">Loading…</p> : null}
        {!loading && filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">No leads match this view.</p>
        ) : null}
      </div>

      {cursor ? (
        <button
          type="button"
          onClick={() => void load(cursor, true)}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
