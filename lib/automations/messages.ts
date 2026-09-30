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
  computeAutomationDueAt,
  skipReasonFor,
  type DriveScheduleContext,
} from "./schedule";

/**
 * Seed the delivery matrix for a new registration: one entry per enabled
 * automation and channel, pre-resolved due dates, and permanent skips already
 * marked so the runner never has to reconsider them.
 */
export function buildInitialMessages(
  ctx: DriveScheduleContext,
  registeredAt: Date,
): {
  messages: RegistrationMessages;
  thingsToCarryDueAt: Date | null;
} {
  const messages: RegistrationMessages = {};
  let thingsToCarryDueAt: Date | null = null;

  for (const kind of AUTOMATION_KINDS) {
    const automation = ctx.automations[kind];
    if (!automation || !automation.enabled) continue;

    const due = computeAutomationDueAt(ctx, kind, registeredAt);
    if (kind === "things_to_carry") thingsToCarryDueAt = due;

    const delivery: AutomationDelivery = { dueAt: due ? due.toISOString() : null };

    for (const channel of automation.channels) {
      if (due) {
        delivery[channel] = emptyChannelDelivery("pending");
        continue;
      }
      // Null due date means this lead can never receive it — record why now.
      const reason = automation.cutoffIst ? "cutoff" : "not_applicable";
      delivery[channel] = {
        ...emptyChannelDelivery("skipped"),
        skippedReason: skipReasonFor(ctx, kind, reason),
      };
    }

    messages[kind] = delivery;
  }

  return { messages, thingsToCarryDueAt };
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
