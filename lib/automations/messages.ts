import { firstNameFrom } from "@/lib/first-name";
import { AUTOMATION_KINDS } from "./types";
import {
  emptyChannelDelivery,
  type AutomationDelivery,
  type ChannelDelivery,
  type MessageStatus,
  type RegistrationMessages,
} from "./types";
import {
  computeReminderDayBeforeDueAt,
  computeReminderEventDayDueAt,
  computeThingsToCarryDueAt,
} from "./schedule";
import { getAutomation } from "./catalog";

export function buildInitialMessages(registeredAt: Date): {
  messages: RegistrationMessages;
  thingsToCarryDueAt: Date | null;
} {
  const ttcDue = computeThingsToCarryDueAt(registeredAt);
  const dayBeforeDue = computeReminderDayBeforeDueAt(registeredAt);
  const eventDayDue = computeReminderEventDayDueAt(registeredAt);
  const messages: RegistrationMessages = {};

  for (const kind of AUTOMATION_KINDS) {
    const def = getAutomation(kind);
    const delivery: AutomationDelivery = {};
    for (const channel of def.channels) {
      delivery[channel] = emptyChannelDelivery("pending");
    }
    if (kind === "things_to_carry") {
      delivery.dueAt = ttcDue ? ttcDue.toISOString() : null;
      if (!ttcDue && delivery.whatsapp) {
        delivery.whatsapp = {
          ...emptyChannelDelivery("skipped"),
          skippedReason: "Past the 8:45 AM IST cutoff on event day.",
        };
      }
    }
    if (kind === "reminder_day_before") {
      delivery.dueAt = dayBeforeDue ? dayBeforeDue.toISOString() : null;
      if (!dayBeforeDue) {
        const skipped = {
          ...emptyChannelDelivery("skipped"),
          skippedReason: "Event-day registrations do not receive the day-before reminder.",
        };
        if (delivery.whatsapp) delivery.whatsapp = skipped;
        if (delivery.email) delivery.email = { ...skipped };
      }
    }
    if (kind === "reminder_event_day") {
      delivery.dueAt = eventDayDue ? eventDayDue.toISOString() : null;
    }
    messages[kind] = delivery;
  }

  return { messages, thingsToCarryDueAt: ttcDue };
}

export function parseChannelDelivery(raw: unknown): ChannelDelivery | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  const status = String(d.status || "pending") as MessageStatus;
  return {
    status,
    sentAt: typeof d.sentAt === "string" ? d.sentAt : null,
    claimedAt: typeof d.claimedAt === "string" ? d.claimedAt : null,
    error: typeof d.error === "string" ? d.error : null,
    providerMessageId:
      typeof d.providerMessageId === "string" ? d.providerMessageId : null,
    skippedReason: typeof d.skippedReason === "string" ? d.skippedReason : null,
  };
}

export function parseRegistrationMessages(
  raw: unknown,
): RegistrationMessages | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out: RegistrationMessages = {};
  for (const kind of AUTOMATION_KINDS) {
    const block = src[kind];
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    out[kind] = {
      whatsapp: parseChannelDelivery(b.whatsapp),
      email: parseChannelDelivery(b.email),
      dueAt: typeof b.dueAt === "string" ? b.dueAt : null,
    };
  }
  return out;
}

export function greetingName(
  firstName: string | null | undefined,
  fullName: string,
): string {
  const stored = String(firstName || "").trim();
  if (stored) return stored;
  return firstNameFrom(fullName);
}
