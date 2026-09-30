"use client";

import Link from "next/link";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";
import { useAdminDrive } from "./drive-context";

/**
 * Active placement drive for the whole dashboard. Changing it re-scopes every
 * page — leads, automations, analytics and logs all follow the selection.
 */
export function DriveSelector() {
  const { drives, driveId, drive, loading, error, setDriveId } = useAdminDrive();

  if (error) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  if (!loading && drives.length === 0) {
    return (
      <Link
        href="/admin/drives"
        className="rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
      >
        Create your first placement drive
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label
        htmlFor="admin-drive-selector"
        className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.6px] text-muted sm:block"
      >
        Placement drive
      </label>
      <div className="relative min-w-0">
        <select
          id="admin-drive-selector"
          value={driveId}
          disabled={loading}
          onChange={(e) => setDriveId(e.target.value)}
          className="w-full min-w-0 max-w-[18rem] appearance-none truncate rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm font-medium text-ink disabled:opacity-60"
        >
          {loading && !driveId ? <option value="">Loading…</option> : null}
          {drives.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.enabled ? "" : " (disabled)"}
            </option>
          ))}
        </select>
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        )}
      </div>
      {drive?.issues?.length ? (
        <Link
          href={`/admin/drives/${drive.id}`}
          title={drive.issues.join(" ")}
          className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{drive.issues.length} to fix</span>
        </Link>
      ) : null}
    </div>
  );
}
