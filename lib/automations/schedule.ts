import { getIstParts, istWallClockToUtc } from "./ist";
import {
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

/**
 * When the "things to carry" WhatsApp should go out.
 * Returns null when it should never send (past the 22 Aug 8:45 AM IST cutoff).
 */
export function computeThingsToCarryDueAt(registeredAt: Date): Date | null {
  const cutoff = thingsToCarryCutoff();
  if (registeredAt.getTime() >= cutoff.getTime()) return null;

  let due = new Date(registeredAt.getTime() + 60 * 60 * 1000);
  if (isWhatsAppQuietHours(due)) {
    due = nextWhatsAppWindowStart(due);
  }
  if (due.getTime() >= cutoff.getTime()) return null;
  return due;
}

export function isScheduledAutomationDue(
  kind: AutomationKind,
  now: Date = new Date(),
): boolean {
  const sendAt = scheduledSendAt(kind);
  if (!sendAt) return true;
  return now.getTime() >= sendAt.getTime();
}

export type Eligibility =
  | { ok: true }
  | { ok: false; reason: "not_due" | "already_sent" | "in_flight" | "cutoff" | "quiet_hours" };

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
    if (status === "failed" && !input.retryFailed && !input.force) {
      return { ok: false, reason: "already_sent" };
    }
  }

  if (input.force || resend) return { ok: true };

  if (input.kind === "things_to_carry") {
    const cutoff = thingsToCarryCutoff();
    if (now.getTime() >= cutoff.getTime()) {
      return { ok: false, reason: "cutoff" };
    }
    const due =
      input.dueAt ??
      (input.registeredAt
        ? computeThingsToCarryDueAt(input.registeredAt)
        : null);
    if (!due) return { ok: false, reason: "cutoff" };
    if (now.getTime() < due.getTime()) return { ok: false, reason: "not_due" };
    if (input.channel === "whatsapp" && isWhatsAppQuietHours(now)) {
      return { ok: false, reason: "quiet_hours" };
    }
    return { ok: true };
  }

  if (def.schedule.type === "at" && !isScheduledAutomationDue(input.kind, now)) {
    return { ok: false, reason: "not_due" };
  }

  if (input.channel === "whatsapp" && isWhatsAppQuietHours(now)) {
    return { ok: false, reason: "quiet_hours" };
  }

  return { ok: true };
}
