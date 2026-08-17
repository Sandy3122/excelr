import { QUALIFICATION_OPTIONS } from "@/lib/reg-content";
import {
  AUTOMATION_KINDS,
  type AutomationKind,
  type Channel,
  type MessageStatus,
} from "@/lib/automations/types";
import type { StoredRegistration } from "@/lib/firebase/registration-types";

export const DELIVERY_FILTERS = [
  "",
  "pending",
  "sent",
  "failed",
  "skipped",
] as const;

export type DeliveryFilter = (typeof DELIVERY_FILTERS)[number];

export interface LeadFilters {
  q: string;
  qualification: string;
  college: string;
  status: DeliveryFilter;
  /** Which automation the status filter applies to. "" = any. */
  statusKind: AutomationKind | "";
}

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  q: "",
  qualification: "",
  college: "",
  status: "",
  statusKind: "",
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
): Exclude<DeliveryFilter, ""> | "sending" {
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
  status: Exclude<DeliveryFilter, "">,
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
  if (filters.qualification && reg.qualification !== filters.qualification) {
    return false;
  }
  if (filters.college && reg.college !== filters.college) return false;

  const status = filters.status;
  if (!status) return true;

  const statusKind = lockedKind ?? filters.statusKind;
  if (statusKind) return kindMatchesStatus(reg, statusKind, status);
  return AUTOMATION_KINDS.some((kind) => kindMatchesStatus(reg, kind, status));
}

export function hasActiveLeadFilters(filters: LeadFilters): boolean {
  return Boolean(
    filters.q.trim() ||
      filters.qualification ||
      filters.college ||
      filters.status ||
      filters.statusKind,
  );
}

export function uniqueColleges(leads: StoredRegistration[]): string[] {
  return [...new Set(leads.map((r) => r.college.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
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
