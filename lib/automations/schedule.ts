/**
 * When an automation is allowed to send, for one placement drive.
 *
 * Every timing decision reads from the drive's configuration — event dates,
 * per-automation schedule, cutoffs, quiet hours. Nothing here knows about a
 * specific campaign.
 */

import { getIstParts, istDateKey, istWallClockToUtc } from "./ist";
import type { AutomationKind, Channel, MessageStatus } from "./types";
import type {
  DriveAutomationConfig,
  DriveAutomations,
  QuietHours,
} from "@/lib/drives/types";

/** Everything scheduling needs from a drive, without the whole document. */
export interface DriveScheduleContext {
  eventDayIstDate: string | null;
  dayBeforeIstDate: string | null;
  quietHours: QuietHours;
  automations: DriveAutomations;
}

const STALE_CLAIM_MS = 5 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function driveScheduleContext(drive: {
  eventDayIstDate: string | null;
  dayBeforeIstDate: string | null;
  whatsapp: { quietHours: QuietHours };
  automations: DriveAutomations;
}): DriveScheduleContext {
  return {
    eventDayIstDate: drive.eventDayIstDate,
    dayBeforeIstDate: drive.dayBeforeIstDate,
    quietHours: drive.whatsapp.quietHours,
    automations: drive.automations,
  };
}

// ─── Quiet hours ───────────────────────────────────────────────────────────

export function isWhatsAppQuietHours(
  ctx: DriveScheduleContext,
  date: Date = new Date(),
): boolean {
  const q = ctx.quietHours;
  if (!q.enabled) return false;
  const { hour } = getIstParts(date);
  // Windows that wrap midnight (21:00 → 08:00) versus same-day windows.
  if (q.startHourIst > q.endHourIst) {
    return hour >= q.startHourIst || hour < q.endHourIst;
  }
  return hour >= q.startHourIst && hour < q.endHourIst;
}

/**
 * Event-day daytime overrides quiet hours, so a lead who signs up on the
 * morning of the drive still gets their messages.
 */
export function shouldBypassWhatsAppQuietHours(
  ctx: DriveScheduleContext,
  date: Date,
): boolean {
  if (!ctx.eventDayIstDate) return false;
  if (istDateKey(date) !== ctx.eventDayIstDate) return false;
  return getIstParts(date).hour < ctx.quietHours.startHourIst;
}

function whatsappBlocked(ctx: DriveScheduleContext, date: Date): boolean {
  return (
    isWhatsAppQuietHours(ctx, date) && !shouldBypassWhatsAppQuietHours(ctx, date)
  );
}

/** Start of the next sending window at or after `date`. */
export function nextWhatsAppWindowStart(
  ctx: DriveScheduleContext,
  date: Date,
): Date {
  const resume = ctx.quietHours.endHourIst;
  const pad = (n: number) => String(n).padStart(2, "0");
  const p = getIstParts(date);
  const todayResume = istWallClockToUtc(
    `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(resume)}:00:00`,
  );
  if (date.getTime() <= todayResume.getTime()) return todayResume;

  const next = new Date(todayResume.getTime() + 24 * 60 * 60 * 1000);
  const n = getIstParts(next);
  return istWallClockToUtc(
    `${n.year}-${pad(n.month)}-${pad(n.day)}T${pad(resume)}:00:00`,
  );
}

// ─── Schedule resolution ───────────────────────────────────────────────────

/** Absolute send time for `at` schedules; null for relative ones. */
export function scheduledSendAt(
  ctx: DriveScheduleContext,
  kind: AutomationKind,
): Date | null {
  const schedule = ctx.automations[kind]?.schedule;
  if (!schedule || schedule.type !== "at") return null;
  return istWallClockToUtc(schedule.atIst);
}

export function automationCutoff(
  ctx: DriveScheduleContext,
  kind: AutomationKind,
): Date | null {
  const cutoffIst = ctx.automations[kind]?.cutoffIst;
  return cutoffIst ? istWallClockToUtc(cutoffIst) : null;
}

/**
 * Whether a registration falls inside the drive's "late" window — the day
 * before or the day of the event — which shortens relative delays.
 */
function lateWindow(
  ctx: DriveScheduleContext,
  registeredAt: Date,
): "event_day" | "day_before" | null {
  const key = istDateKey(registeredAt);
  if (ctx.eventDayIstDate && key === ctx.eventDayIstDate) return "event_day";
  if (ctx.dayBeforeIstDate && key === ctx.dayBeforeIstDate) {
    // Only counts as late once the day-before reminder has already gone out.
    const dayBeforeSend = scheduledSendAt(ctx, "reminder_day_before");
    if (dayBeforeSend && registeredAt.getTime() >= dayBeforeSend.getTime()) {
      return "day_before";
    }
  }
  return null;
}

/** Delay for a `delay_after_register` automation, honouring the late window. */
function relativeDelayMs(
  ctx: DriveScheduleContext,
  automation: DriveAutomationConfig,
  registeredAt: Date,
): { delayMs: number; lastChance: boolean } {
  const base =
    automation.schedule.type === "delay_after_register"
      ? automation.schedule.delayMinutes * MINUTE_MS
      : 0;
  const window = lateWindow(ctx, registeredAt);
  const lateMs =
    automation.lateWindowDelayMinutes != null
      ? automation.lateWindowDelayMinutes * MINUTE_MS
      : null;
  const lastChanceMs =
    automation.lastChanceDelayMinutes != null
      ? automation.lastChanceDelayMinutes * MINUTE_MS
      : null;
  const cutoff = automation.cutoffIst
    ? istWallClockToUtc(automation.cutoffIst)
    : null;

  if (window === "event_day" && lateMs != null && lastChanceMs != null) {
    // Prefer the normal late delay while it still lands before the cutoff.
    if (
      cutoff &&
      registeredAt.getTime() < cutoff.getTime() &&
      registeredAt.getTime() + lateMs < cutoff.getTime()
    ) {
      return { delayMs: lateMs, lastChance: false };
    }
    return { delayMs: lastChanceMs, lastChance: true };
  }

  if (window && lateMs != null) return { delayMs: lateMs, lastChance: false };
  return { delayMs: base, lastChance: false };
}

/**
 * When this automation should fire for a lead who registered at `registeredAt`.
 * Null means it must never send.
 */
export function computeAutomationDueAt(
  ctx: DriveScheduleContext,
  kind: AutomationKind,
  registeredAt: Date | null,
): Date | null {
  const automation = ctx.automations[kind];
  if (!automation || !automation.enabled) return null;

  if (!registeredAt) return scheduledSendAt(ctx, kind);

  if (
    automation.skipOnOrAfterIstDate &&
    istDateKey(registeredAt) >= automation.skipOnOrAfterIstDate
  ) {
    return null;
  }

  if (automation.schedule.type === "immediate") return registeredAt;

  let due: Date;
  let lastChance = false;

  if (automation.schedule.type === "delay_after_register") {
    const resolved = relativeDelayMs(ctx, automation, registeredAt);
    lastChance = resolved.lastChance;
    due = new Date(registeredAt.getTime() + resolved.delayMs);
  } else {
    const at = istWallClockToUtc(automation.schedule.atIst);
    due =
      registeredAt.getTime() < at.getTime()
        ? at
        : new Date(
            registeredAt.getTime() +
              automation.schedule.lateDelayMinutes * MINUTE_MS,
          );
  }

  if (automation.channels.includes("whatsapp") && whatsappBlocked(ctx, due)) {
    due = nextWhatsAppWindowStart(ctx, due);
  }

  // Holding for quiet hours can push a send past the day it was meant for.
  if (
    automation.skipOnOrAfterIstDate &&
    istDateKey(due) >= automation.skipOnOrAfterIstDate
  ) {
    return null;
  }

  if (!lastChance && automation.cutoffIst) {
    const cutoff = istWallClockToUtc(automation.cutoffIst);
    if (due.getTime() >= cutoff.getTime()) return null;
  }

  return due;
}

/** Whether a fixed-time automation has come due for the drive as a whole. */
export function isScheduledAutomationDue(
  ctx: DriveScheduleContext,
  kind: AutomationKind,
  now: Date = new Date(),
): boolean {
  const automation = ctx.automations[kind];
  if (!automation || !automation.enabled) return false;
  if (
    automation.skipOnOrAfterIstDate &&
    istDateKey(now) >= automation.skipOnOrAfterIstDate
  ) {
    return false;
  }
  const sendAt = scheduledSendAt(ctx, kind);
  if (!sendAt) return true;
  return now.getTime() >= sendAt.getTime();
}

// ─── Eligibility ───────────────────────────────────────────────────────────

export type EligibilityReason =
  | "not_due"
  | "already_sent"
  | "in_flight"
  | "cutoff"
  | "quiet_hours"
  | "not_applicable"
  | "disabled";

export type Eligibility = { ok: true } | { ok: false; reason: EligibilityReason };

export interface ChannelSnapshot {
  status?: MessageStatus | null;
  claimedAt?: string | null;
}

export interface EligibilityInput {
  ctx: DriveScheduleContext;
  kind: AutomationKind;
  channel: Channel;
  now?: Date;
  force?: boolean;
  retryFailed?: boolean;
  resend?: boolean;
  dueAt?: Date | null;
  registeredAt?: Date | null;
  snapshot?: ChannelSnapshot;
  /** Status of the automation this one waits on, if any. */
  waitForStatus?: MessageStatus | null;
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

function gateFinished(status?: MessageStatus | null): boolean {
  return status === "sent" || status === "skipped" || status === "legacy";
}

export function evaluateEligibility(input: EligibilityInput): Eligibility {
  const now = input.now ?? new Date();
  const automation = input.ctx.automations[input.kind];
  const status = input.snapshot?.status;
  const resend = Boolean(input.resend);

  if (!automation || !automation.enabled) {
    return { ok: false, reason: "disabled" };
  }
  if (!automation.channels.includes(input.channel)) {
    return { ok: false, reason: "not_applicable" };
  }

  if (status === "sending" && !isClaimStale(input.snapshot?.claimedAt, now)) {
    return { ok: false, reason: "in_flight" };
  }

  if (!resend) {
    // A welcome with no recorded status predates delivery tracking.
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
    input.dueAt ??
    computeAutomationDueAt(input.ctx, input.kind, input.registeredAt ?? null);

  if (!due) {
    // An immediate automation has no due date of its own — for a lead whose
    // registration time was never recorded it is simply due now.
    if (automation.schedule.type !== "immediate") {
      // A cutoff produces a permanent skip; a skip-date is "not applicable".
      return {
        ok: false,
        reason: automation.cutoffIst ? "cutoff" : "not_applicable",
      };
    }
  } else if (now.getTime() < due.getTime()) {
    return { ok: false, reason: "not_due" };
  }

  if (automation.waitForKind && !gateFinished(input.waitForStatus)) {
    return { ok: false, reason: "not_due" };
  }

  if (input.channel === "whatsapp" && whatsappBlocked(input.ctx, now)) {
    return { ok: false, reason: "quiet_hours" };
  }

  return { ok: true };
}

/** Reason text stored on a permanently skipped delivery. */
export function skipReasonFor(
  ctx: DriveScheduleContext,
  kind: AutomationKind,
  reason: EligibilityReason,
): string {
  const automation = ctx.automations[kind];
  if (reason === "cutoff" && automation?.cutoffIst) {
    return `Past the ${automation.cutoffIst.replace("T", " ")} IST cutoff.`;
  }
  if (reason === "not_applicable" && automation?.skipOnOrAfterIstDate) {
    return `Registrations on or after ${automation.skipOnOrAfterIstDate} do not receive this message.`;
  }
  if (reason === "disabled") return "This automation is turned off for the drive.";
  return "Not applicable for this registration.";
}
