import type { MessageStatus } from "@/lib/automations/types";

const STYLES: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  legacy: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  failed: "bg-red-50 text-red-800 ring-red-200",
  skipped: "bg-slate-100 text-slate-600 ring-slate-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  sending: "bg-sky-50 text-sky-800 ring-sky-200",
};

const LABELS: Record<string, string> = {
  sent: "Sent",
  legacy: "Sent",
  failed: "Failed",
  skipped: "Skipped",
  pending: "Pending",
  sending: "Sending",
};

/**
 * Display text for a delivery status. `sent` and `legacy` read the same, which
 * is what lets the delivery badge collapse them into one pill.
 */
export function statusLabel(status?: MessageStatus | string | null): string {
  const key = status || "pending";
  return LABELS[key] || key;
}

export function StatusBadge({
  status,
  prefix,
  title,
}: {
  status?: MessageStatus | string | null;
  /** Short channel marker, shown only when a row's channels disagree. */
  prefix?: string;
  title?: string;
}) {
  const key = status || "pending";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        STYLES[key] || STYLES.pending
      }`}
    >
      {prefix ? <span className="opacity-60">{prefix}</span> : null}
      {statusLabel(status)}
    </span>
  );
}
