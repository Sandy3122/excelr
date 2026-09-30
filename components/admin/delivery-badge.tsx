import type { Channel, MessageStatus } from "@/lib/automations/types";
import { summariseDelivery } from "@/lib/admin/lead-filters";
import { StatusBadge, statusLabel } from "./status-badge";

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
};

/** Short marker, shown only when a row's channels disagree. */
const CHANNEL_SHORT: Record<Channel, string> = {
  whatsapp: "WA",
  email: "EM",
};

/**
 * Delivery for one automation on one lead.
 *
 * Channels collapse to a single badge whenever they read the same, which is the
 * common case — two identical "Sent" pills stacked on top of each other carry no
 * more information than one and make the table hard to scan. When they genuinely
 * differ, each badge names its channel, because "Sent / Failed" alone gives no
 * clue which one failed.
 *
 * The decision itself lives in `summariseDelivery` so it can be unit-tested.
 */
export function DeliveryBadge({
  entries,
  enabled = true,
}: {
  entries: { channel: Channel; status: MessageStatus }[];
  /** False when the drive has this automation turned off. */
  enabled?: boolean;
}) {
  const summary = summariseDelivery(entries, { enabled, label: statusLabel });

  if (summary.kind === "disabled") {
    return (
      <span
        title="This automation is turned off for the selected placement drive"
        className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200"
      >
        Off
      </span>
    );
  }

  if (summary.kind === "none") {
    return <span className="text-muted">—</span>;
  }

  if (summary.kind === "single") {
    const channels = summary.channels.map((c) => CHANNEL_LABELS[c]).join(", ");
    return (
      <StatusBadge
        status={summary.status}
        title={`${channels} — ${statusLabel(summary.status).toLowerCase()}`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {summary.entries.map((entry) => (
        <StatusBadge
          key={entry.channel}
          status={entry.status}
          prefix={CHANNEL_SHORT[entry.channel]}
          title={`${CHANNEL_LABELS[entry.channel]} — ${statusLabel(
            entry.status,
          ).toLowerCase()}`}
        />
      ))}
    </div>
  );
}
