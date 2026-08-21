import { getIstParts, istDateKey, istWallClockToUtc } from "./ist";
import {
  DAY_BEFORE_IST_DATE,
  EVENT_DAY_IST_DATE,
  REMINDER_DAY_BEFORE_LATE_DELAY_MS,
  REMINDER_EVENT_DAY_LATE_DELAY_MS,
  TTC_DELAY_MS,
  TTC_LAST_CHANCE_DELAY_MS,
  TTC_LATE_DELAY_MS,
  getAutomation,
  scheduledSendAt,
  thingsToCarryCutoff,
} from "./catalog";
import type { AutomationKind, Channel, MessageStatus } from "./types";

/** Do not send WhatsApp between 9:00 PM and 8:00 AM IST. */
export const WHATSAPP_QUIET_START_HOUR_IST = 21;
export const WHATSAPP_QUIET_END_HOUR_IST = 8;

const STALE_CLAIM_MS = 5 * 60 * 1000;

export function isWhatsAppQuietHours(date: Date = new Date()): boolean {
  const { hour } = getIstParts(date);
  return hour >= WHATSAPP_QUIET_START_HOUR_IST || hour < WHATSAPP_QUIET_END_HOUR_IST;
}

/** Event-day morning/afternoon: allow WhatsApp during quiet hours so late 22 Aug signups still get messages. */
export function shouldBypassWhatsAppQuietHours(date: Date): boolean {
  if (istDateKey(date) !== EVENT_DAY_IST_DATE) return false;
  return getIstParts(date).hour < WHATSAPP_QUIET_START_HOUR_IST;
}

function whatsappBlocked(date: Date): boolean {
  return isWhatsAppQuietHours(date) && !shouldBypassWhatsAppQuietHours(date);
}

function thingsToCarryFinished(status?: MessageStatus | null): boolean {
  return status === "sent" || status === "skipped" || status === "legacy";
}

/** Next 8:00 AM IST at or after `date` (today if still before 8, else tomorrow). */
export function nextWhatsAppWindowStart(date: Date): Date {
  const p = getIstParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayEight = istWallClockToUtc(
    `${p.year}-${pad(p.month)}-${pad(p.day)}T08:00:00`,
  );
  if (date.getTime() <= todayEight.getTime()) return todayEight;

  const next = new Date(todayEight.getTime() + 24 * 60 * 60 * 1000);
  const n = getIstParts(next);
  return istWallClockToUtc(
    `${n.year}-${pad(n.month)}-${pad(n.day)}T08:00:00`,
  );
}

function ttcDelayMs(registeredAt: Date): number {
  const cutoff = thingsToCarryCutoff();
  const eventDay = istDateKey(registeredAt) === EVENT_DAY_IST_DATE;
  const lateDayBefore =
    istDateKey(registeredAt) === DAY_BEFORE_IST_DATE &&
    registeredAt.getTime() >= (scheduledSendAt("reminder_day_before")?.getTime() || 0);

  if (eventDay) {
    const tenMin = new Date(registeredAt.getTime() + TTC_LATE_DELAY_MS);
    if (registeredAt.getTime() < cutoff.getTime() && tenMin.getTime() < cutoff.getTime()) {
      return TTC_LATE_DELAY_MS;
    }
    return TTC_LAST_CHANCE_DELAY_MS;
  }
  if (lateDayBefore) return TTC_LATE_DELAY_MS;
  return TTC_DELAY_MS;
}

/**
 * When the "things to carry" WhatsApp should go out.
 * Returns null when it should never send.
 */
export function computeThingsToCarryDueAt(registeredAt: Date): Date | null {
  const cutoff = thingsToCarryCutoff();
  const delayMs = ttcDelayMs(registeredAt);
  const lastChance = delayMs === TTC_LAST_CHANCE_DELAY_MS;

  let due = new Date(registeredAt.getTime() + delayMs);
  if (whatsappBlocked(due)) {
    due = nextWhatsAppWindowStart(due);
  }
  if (!lastChance && due.getTime() >= cutoff.getTime()) return null;
  return due;
}

/** Null = never send (event-day signups must not get the "tomorrow" reminder). */
export function computeReminderDayBeforeDueAt(registeredAt: Date): Date | null {
  if (istDateKey(registeredAt) >= EVENT_DAY_IST_DATE) return null;
  const scheduled = scheduledSendAt("reminder_day_before");
  if (!scheduled) return null;
  if (registeredAt.getTime() < scheduled.getTime()) return scheduled;
  const due = new Date(registeredAt.getTime() + REMINDER_DAY_BEFORE_LATE_DELAY_MS);
  if (whatsappBlocked(due)) {
    const held = nextWhatsAppWindowStart(due);
    if (istDateKey(held) >= EVENT_DAY_IST_DATE) return null;
    return held;
  }
  if (istDateKey(due) >= EVENT_DAY_IST_DATE) return null;
  return due;
}

export function computeReminderEventDayDueAt(registeredAt: Date): Date | null {
  const scheduled = scheduledSendAt("reminder_event_day");
  if (!scheduled) return null;
  if (
    istDateKey(registeredAt) < EVENT_DAY_IST_DATE ||
    registeredAt.getTime() < scheduled.getTime()
  ) {
    return scheduled;
  }
  return new Date(registeredAt.getTime() + REMINDER_EVENT_DAY_LATE_DELAY_MS);
}

export function computeAutomationDueAt(
  kind: AutomationKind,
  registeredAt: Date | null,
): Date | null {
  if (kind === "welcome") return registeredAt;
  if (!registeredAt) return scheduledSendAt(kind);
  if (kind === "things_to_carry") return computeThingsToCarryDueAt(registeredAt);
  if (kind === "reminder_day_before") return computeReminderDayBeforeDueAt(registeredAt);
  if (kind === "reminder_event_day") return computeReminderEventDayDueAt(registeredAt);
  return null;
}

export function isScheduledAutomationDue(
  kind: AutomationKind,
  now: Date = new Date(),
): boolean {
  if (kind === "reminder_day_before" && istDateKey(now) >= EVENT_DAY_IST_DATE) {
    return false;
  }
  const sendAt = scheduledSendAt(kind);
  if (!sendAt) return true;
  return now.getTime() >= sendAt.getTime();
}

export type Eligibility =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_due"
        | "already_sent"
        | "in_flight"
        | "cutoff"
        | "quiet_hours"
        | "not_applicable";
    };

export interface ChannelSnapshot {
  status?: MessageStatus | null;
  claimedAt?: string | null;
}

export interface EligibilityInput {
  kind: AutomationKind;
  channel: Channel;
  now?: Date;
  force?: boolean;
  retryFailed?: boolean;
  resend?: boolean;
  dueAt?: Date | null;
  registeredAt?: Date | null;
  snapshot?: ChannelSnapshot;
  /** WhatsApp status of things-to-carry; day-before reminder waits until this is done. */
  thingsToCarryStatus?: MessageStatus | null;
}

export function isClaimStale(
  claimedAt: string | null | undefined,
  now: Date,
): boolean {
  if (!claimedAt) return true;
  const t = Date.parse(claimedAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t > STALE_CLAIM_MS;
}

export function evaluateEligibility(input: EligibilityInput): Eligibility {
  const now = input.now ?? new Date();
  const def = getAutomation(input.kind);
  const status = input.snapshot?.status;
  const resend = Boolean(input.resend);

  if (status === "sending" && !isClaimStale(input.snapshot?.claimedAt, now)) {
    return { ok: false, reason: "in_flight" };
  }

  if (!resend) {
    if (!status && input.kind === "welcome") {
      return { ok: false, reason: "already_sent" };
    }
    if (status === "sent" || status === "skipped" || status === "legacy") {
      return { ok: false, reason: "already_sent" };
    }
    if (status === "failed" && !input.retryFailed) {
      return { ok: false, reason: "already_sent" };
    }
  }

  if (input.force || resend) return { ok: true };

  const due =
    input.dueAt ?? computeAutomationDueAt(input.kind, input.registeredAt ?? null);

  if (input.kind === "things_to_carry") {
    if (!due) return { ok: false, reason: "cutoff" };
    if (now.getTime() < due.getTime()) return { ok: false, reason: "not_due" };
    if (input.channel === "whatsapp" && whatsappBlocked(now)) {
      return { ok: false, reason: "quiet_hours" };
    }
    return { ok: true };
  }

  if (input.kind === "reminder_day_before") {
    if (!due) return { ok: false, reason: "not_applicable" };
    if (now.getTime() < due.getTime()) return { ok: false, reason: "not_due" };
    if (!thingsToCarryFinished(input.thingsToCarryStatus)) {
      return { ok: false, reason: "not_due" };
    }
    if (input.channel === "whatsapp" && whatsappBlocked(now)) {
      return { ok: false, reason: "quiet_hours" };
    }
    return { ok: true };
  }

  if (input.kind === "reminder_event_day") {
    if (!due) return { ok: false, reason: "not_due" };
    if (now.getTime() < due.getTime()) return { ok: false, reason: "not_due" };
    if (input.channel === "whatsapp" && whatsappBlocked(now)) {
      return { ok: false, reason: "quiet_hours" };
    }
    return { ok: true };
  }

  if (def.schedule.type === "at" && !isScheduledAutomationDue(input.kind, now)) {
    return { ok: false, reason: "not_due" };
  }

  if (input.channel === "whatsapp" && whatsappBlocked(now)) {
    return { ok: false, reason: "quiet_hours" };
  }

  return { ok: true };
}
