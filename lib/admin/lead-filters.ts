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

const EMAIL_KINDS: AutomationKind[] = ["welcome", "reminder_day_before"];

export function channelsForKind(kind: AutomationKind): Channel[] {
  return EMAIL_KINDS.includes(kind) ? ["whatsapp", "email"] : ["whatsapp"];
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
): MessageStatus[] {
  return channelsForKind(kind).map((channel) =>
    leadChannelStatus(reg, kind, channel),
  );
}

export function kindMatchesStatus(
  reg: StoredRegistration,
  kind: AutomationKind,
  status: DeliveryFilter,
): boolean {
  const rolled = statusesForKind(reg, kind).map(rollupStatus);
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
    filters.statuses.some((status) => kindMatchesStatus(reg, kind, status)),
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
  lockedKind?: AutomationKind,
): string[] {
  return leads
    .filter((reg) => matchesLeadFilters(reg, filters, lockedKind))
    .map((reg) => reg.id);
}
