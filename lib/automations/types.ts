export const AUTOMATION_KINDS = [
  "welcome",
  "things_to_carry",
  "reminder_day_before",
  "reminder_event_day",
] as const;

export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

export const CHANNELS = ["whatsapp", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const MESSAGE_STATUSES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
  "legacy",
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export interface ChannelDelivery {
  status: MessageStatus;
  sentAt: string | null;
  claimedAt: string | null;
  error: string | null;
  providerMessageId: string | null;
  skippedReason: string | null;
}

export interface AutomationDelivery {
  whatsapp?: ChannelDelivery;
  email?: ChannelDelivery;
  dueAt?: string | null;
}

export type RegistrationMessages = Partial<
  Record<AutomationKind, AutomationDelivery>
>;

export interface AutomationRunStats {
  scanned: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface AutomationRun {
  id: string;
  kind: AutomationKind;
  status: "running" | "completed" | "idle";
  triggeredBy: "cron" | "admin";
  force: boolean;
  retryFailed: boolean;
  cursor: string | null;
  stats: AutomationRunStats;
  error: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface ChannelCounts {
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  sending: number;
}

export interface AutomationOverview {
  kind: AutomationKind;
  title: string;
  description: string;
  channels: Channel[];
  scheduleLabel: string;
  sendAtIso: string | null;
  isDue: boolean;
  counts: Record<Channel, ChannelCounts | null>;
}

export function emptyChannelDelivery(
  status: MessageStatus = "pending",
): ChannelDelivery {
  return {
    status,
    sentAt: null,
    claimedAt: null,
    error: null,
    providerMessageId: null,
    skippedReason: null,
  };
}

export function emptyCounts(): ChannelCounts {
  return { sent: 0, failed: 0, skipped: 0, pending: 0, sending: 0 };
}

export function emptyRunStats(): AutomationRunStats {
  return {
    scanned: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  };
}
