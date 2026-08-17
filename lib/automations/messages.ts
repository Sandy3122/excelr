import { firstNameFrom } from "@/lib/first-name";
import { AUTOMATION_KINDS } from "./types";
import {
  emptyChannelDelivery,
  type AutomationDelivery,
  type ChannelDelivery,
  type MessageStatus,
  type RegistrationMessages,
} from "./types";
import { computeThingsToCarryDueAt } from "./schedule";
import { getAutomation } from "./catalog";

export function buildInitialMessages(registeredAt: Date): {
  messages: RegistrationMessages;
  thingsToCarryDueAt: Date | null;
} {
  const due = computeThingsToCarryDueAt(registeredAt);
  const messages: RegistrationMessages = {};

  for (const kind of AUTOMATION_KINDS) {
    const def = getAutomation(kind);
    const delivery: AutomationDelivery = {};
    for (const channel of def.channels) {
      delivery[channel] = emptyChannelDelivery("pending");
    }
    if (kind === "things_to_carry") {
      delivery.dueAt = due ? due.toISOString() : null;
      if (!due && delivery.whatsapp) {
        delivery.whatsapp = {
          ...emptyChannelDelivery("skipped"),
          skippedReason: "Past the 8:45 AM IST cutoff on event day.",
        };
      }
    }
    messages[kind] = delivery;
  }

  return { messages, thingsToCarryDueAt: due };
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
