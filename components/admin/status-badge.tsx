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

export function StatusBadge({ status }: { status?: MessageStatus | string | null }) {
  const key = status || "pending";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        STYLES[key] || STYLES.pending
      }`}
    >
      {LABELS[key] || key}
    </span>
  );
}
