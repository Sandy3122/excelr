import { QUALIFICATION_OPTIONS } from "@/lib/reg-content";
import {
  AUTOMATION_KINDS,
  type AutomationKind,
  type Channel,
  type MessageStatus,
} from "@/lib/automations/types";
import type { StoredRegistration } from "@/lib/firebase/registration-types";

export const DELIVERY_FILTER_VALUES = [
  "pending",
  "sent",
  "failed",
  "skipped",
] as const;

export type DeliveryFilter = (typeof DELIVERY_FILTER_VALUES)[number];

export interface LeadFilters {
  q: string;
  qualifications: string[];
  colleges: string[];
  statuses: DeliveryFilter[];
  /** Which automations the status filter applies to. Empty = any. */
  statusKinds: AutomationKind[];
}

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  q: "",
  qualifications: [],
  colleges: [],
  statuses: [],
  statusKinds: [],
};

export const QUALIFICATION_FILTER_OPTIONS = QUALIFICATION_OPTIONS;

/**
 * Which channels an automation uses, and whether it runs at all, for the drive
 * currently being viewed. Supplied by the caller rather than assumed: the same
 * automation may be WhatsApp-only on one campaign and WhatsApp + email on
 * another, and a drive can turn it off entirely.
 */
export type DriveAutomationView = Record<
  AutomationKind,
  { enabled: boolean; channels: Channel[] }
>;

/** Fallback when no drive is loaded yet - WhatsApp only, nothing disabled. */
export const DEFAULT_AUTOMATION_VIEW: DriveAutomationView = Object.fromEntries(
  AUTOMATION_KINDS.map((kind) => [
    kind,
    { enabled: true, channels: ["whatsapp"] as Channel[] },
  ]),
) as DriveAutomationView;

export function channelsForKind(
  kind: AutomationKind,
  view: DriveAutomationView,
): Channel[] {
  return view[kind]?.channels ?? [];
}

export function leadChannelStatus(
  reg: StoredRegistration,
  kind: AutomationKind,
  channel: Channel,
): MessageStatus {
  const status = reg.messages?.[kind]?.[channel]?.status;
  if (status) return status;
  return kind === "welcome" ? "legacy" : "pending";
}

export function rollupStatus(
  status: MessageStatus,
): DeliveryFilter | "sending" {
  if (status === "legacy" || status === "sent") return "sent";
  if (status === "sending") return "sending";
  if (status === "failed") return "failed";
  if (status === "skipped") return "skipped";
  return "pending";
}

export function statusesForKind(
  reg: StoredRegistration,
  kind: AutomationKind,
  view: DriveAutomationView,
): MessageStatus[] {
  return channelsForKind(kind, view).map((channel) =>
    leadChannelStatus(reg, kind, channel),
  );
}

/** Channel + status pairs for one automation, ready to render. */
export function deliveriesForKind(
  reg: StoredRegistration,
  kind: AutomationKind,
  view: DriveAutomationView,
): { channel: Channel; status: MessageStatus }[] {
  return channelsForKind(kind, view).map((channel) => ({
    channel,
    status: leadChannelStatus(reg, kind, channel),
  }));
}

export function kindMatchesStatus(
  reg: StoredRegistration,
  kind: AutomationKind,
  status: DeliveryFilter,
  view: DriveAutomationView,
): boolean {
  // A disabled automation has no delivery to match on.
  if (!view[kind]?.enabled) return false;
  const rolled = statusesForKind(reg, kind, view).map(rollupStatus);
  if (rolled.length === 0) return false;
  if (status === "pending") {
    return rolled.some((s) => s === "pending" || s === "sending");
  }
  if (status === "failed") return rolled.some((s) => s === "failed");
  if (status === "skipped") return rolled.some((s) => s === "skipped");
  return rolled.every((s) => s === "sent");
}

export function matchesLeadFilters(
  reg: StoredRegistration,
  filters: LeadFilters,
  view: DriveAutomationView,
  lockedKind?: AutomationKind,
): boolean {
  const needle = filters.q.trim().toLowerCase();
  if (needle) {
    const hay = [reg.fullName, reg.email, reg.phone, reg.college, reg.qualification]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  if (
    filters.qualifications.length > 0 &&
    !filters.qualifications.includes(reg.qualification)
  ) {
    return false;
  }
  if (filters.colleges.length > 0 && !filters.colleges.includes(reg.college)) {
    return false;
  }

  if (filters.statuses.length === 0) return true;

  const kinds = lockedKind
    ? [lockedKind]
    : filters.statusKinds.length > 0
      ? filters.statusKinds
      : [...AUTOMATION_KINDS];
  return kinds.some((kind) =>
    filters.statuses.some((status) =>
      kindMatchesStatus(reg, kind, status, view),
    ),
  );
}

export function hasActiveLeadFilters(
  filters: LeadFilters,
  lockedKind?: AutomationKind,
): boolean {
  return Boolean(
    filters.q.trim() ||
      filters.qualifications.length ||
      filters.colleges.length ||
      filters.statuses.length ||
      (!lockedKind && filters.statusKinds.length),
  );
}

export function uniqueColleges(leads: StoredRegistration[]): string[] {
  return [...new Set(leads.map((r) => r.college.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
}

export function uniqueQualifications(leads: StoredRegistration[]): string[] {
  const fromData = new Set(
    leads.map((r) => r.qualification.trim()).filter(Boolean),
  );
  if (fromData.size === 0) return [...QUALIFICATION_OPTIONS];
  const knownSet = new Set<string>(QUALIFICATION_OPTIONS);
  const known = QUALIFICATION_OPTIONS.filter((opt) => fromData.has(opt));
  const extra = [...fromData]
    .filter((opt) => !knownSet.has(opt))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...extra];
}

export function idsMatching(
  leads: StoredRegistration[],
  filters: LeadFilters,
  view: DriveAutomationView,
  lockedKind?: AutomationKind,
): string[] {
  return leads
    .filter((reg) => matchesLeadFilters(reg, filters, view, lockedKind))
    .map((reg) => reg.id);
}

/**
 * How one automation's delivery should be shown for a lead.
 *
 * `single` when every channel reads the same - two identical "Sent" pills carry
 * no more information than one. `split` when they genuinely differ, in which
 * case each badge needs its channel named, because "Sent / Failed" alone gives
 * no clue which channel failed.
 *
 * Statuses are compared by display label, so `sent` and `legacy` (both shown as
 * "Sent") collapse together.
 */
export type DeliverySummary =
  | { kind: "disabled" }
  | { kind: "none" }
  | { kind: "single"; status: MessageStatus; channels: Channel[] }
  | { kind: "split"; entries: { channel: Channel; status: MessageStatus }[] };

export function summariseDelivery(
  entries: { channel: Channel; status: MessageStatus }[],
  options: { enabled: boolean; label: (status: MessageStatus) => string },
): DeliverySummary {
  if (!options.enabled) return { kind: "disabled" };
  if (entries.length === 0) return { kind: "none" };
  const labels = new Set(entries.map((e) => options.label(e.status)));
  if (labels.size === 1) {
    return {
      kind: "single",
      status: entries[0].status,
      channels: entries.map((e) => e.channel),
    };
  }
  return { kind: "split", entries };
}
