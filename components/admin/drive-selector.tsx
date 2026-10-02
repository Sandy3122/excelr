"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2 } from "lucide-react";
import { useAdminDrive } from "./drive-context";

/**
 * Active placement drive for the whole dashboard. Changing it re-scopes every
 * page — leads, automations, analytics and logs all follow the selection.
 *
 * This is a popover rather than a native <select> on purpose: drive names are
 * long ("Java Full Stack Placement Drive — BTM, Aug 2026"), and the
 * OS menu a native select opens is drawn outside the page, sized to the longest
 * option and anchored over the selected row. Sitting this high in the layout,
 * that menu covered the header and ran off the top of the window. A popover
 * stays inside the page, always opens below the trigger, and leaves room for
 * the event date and status each drive carries.
 */
export function DriveSelector() {
  const { drives, driveId, drive, loading, error, setDriveId } = useAdminDrive();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

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

  const current = drives.find((d) => d.id === driveId);

  /** Arrow keys move between drives the way they would in a native select. */
  function handleTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    const index = drives.findIndex((d) => d.id === driveId);
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    if (next >= 0 && next < drives.length) setDriveId(drives[next].id);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        id="admin-drive-selector-label"
        className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.6px] text-muted sm:block"
      >
        Placement drive
      </span>
      <div ref={rootRef} className="relative min-w-0">
        <button
          type="button"
          id="admin-drive-selector"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          // The button's own text is the drive name, so the name it exposes
          // needs the "Placement drive" prefix the visible label carries.
          aria-label={`Placement drive: ${current?.name || "loading"}`}
          disabled={loading && !current}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={handleTriggerKeyDown}
          className="flex w-full min-w-0 max-w-[22rem] items-center gap-2 rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-2.5 text-left text-sm font-medium text-ink transition hover:border-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60"
        >
          <span className="min-w-0 flex-1 truncate">
            {current ? (
              <>
                {current.name}
                {current.enabled ? "" : " (disabled)"}
              </>
            ) : (
              "Loading…"
            )}
          </span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
          ) : (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby="admin-drive-selector-label"
            className="absolute left-0 z-50 mt-1 max-h-[60vh] w-max min-w-full max-w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-card-lg"
          >
            {drives.map((d) => {
              const selected = d.id === driveId;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      if (d.id !== driveId) setDriveId(d.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                      selected ? "bg-brand-blue/10 text-navy-900" : "hover:bg-slate-50"
                    }`}
                  >
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        selected ? "text-brand-blue" : "invisible"
                      }`}
                      strokeWidth={3}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{d.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {d.eventDayIstDate || "No event date"}
                        {d.enabled ? "" : " · Disabled"}
                        {d.archived ? " · Archived" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
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
