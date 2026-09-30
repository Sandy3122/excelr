import { hasInfobipConfig } from "@/lib/whatsapp-otp/config";
import { sendNamedWhatsAppTemplateBatch } from "@/lib/whatsapp-otp/infobip";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import {
  listRegistrationsAscending,
  getRegistrationById,
  getRegistrationsByIds,
  phoneToDocId,
} from "@/lib/firebase/registrations";
import type { PlacementDrive } from "@/lib/drives/types";
import {
  DriveConfigurationError,
  driveAutomationTemplate,
  driveSendConfig,
} from "@/lib/drives/whatsapp";
import { channelsForAutomationRun } from "./catalog";
import {
  driveScheduleContext,
  evaluateEligibility,
  skipReasonFor,
  type DriveScheduleContext,
} from "./schedule";
import { greetingName } from "./messages";
import { sendAutomationEmail } from "./mail";
import {
  claimChannel,
  createAutomationRun,
  extendChannelClaim,
  patchAutomationRun,
  persistChannelDelivery,
  setChannelDelivery,
  setCronCursor,
} from "./store";
import { shouldStartCronBatch, CRON_BATCH_HEADROOM_MS } from "./cron-limits";
import {
  emptyChannelDelivery,
  emptyRunStats,
  type AutomationKind,
  type AutomationRun,
  type AutomationRunStats,
  type Channel,
  type MessageStatus,
} from "./types";

const PAGE_SIZE = 80;
const WHATSAPP_BATCH = 40;
const EMAIL_CONCURRENCY = 6;
const WRITE_CONCURRENCY = 8;
const TIME_BUDGET_MS = 45_000;
const BATCH_HEADROOM_MS = 6_000;

export interface RunAutomationOptions {
  drive: PlacementDrive;
  kind: AutomationKind;
  triggeredBy: "cron" | "admin";
  force?: boolean;
  retryFailed?: boolean;
  /** Re-send even if the message was already delivered. */
  resend?: boolean;
  /** Send only this registration (admin per-row send). */
  registrationId?: string;
  /** Send only these registrations (admin selected / filtered batch). */
  registrationIds?: string[];
  /** Admin opt-in: also send email when the automation has one. Cron ignores this. */
  includeEmail?: boolean;
  timeBudgetMs?: number;
  /** Resume an oldest-first scan from this registration id. */
  startCursor?: string;
  /** Cap Infobip send batches this invocation (cron uses 1). */
  maxSendBatches?: number;
  /** Persist scan cursor so the next cron tick continues. */
  persistCursor?: boolean;
}

function infobipTo(phone: string): string {
  return phoneToDocId(phone);
}

function channelSnapshot(
  reg: StoredRegistration,
  kind: AutomationKind,
  channel: Channel,
) {
  return {
    status: reg.messages?.[kind]?.[channel]?.status,
    claimedAt: reg.messages?.[kind]?.[channel]?.claimedAt,
  };
}

function dueAtFor(reg: StoredRegistration, kind: AutomationKind): Date | null {
  const raw =
    kind === "things_to_carry"
      ? reg.thingsToCarryDueAt || reg.messages?.things_to_carry?.dueAt
      : reg.messages?.[kind]?.dueAt;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Status of the automation this one is gated on, if the drive configures one. */
function waitForStatusFor(
  ctx: DriveScheduleContext,
  reg: StoredRegistration,
  kind: AutomationKind,
): MessageStatus | null | undefined {
  const waitFor = ctx.automations[kind]?.waitForKind;
  if (!waitFor) return undefined;
  return reg.messages?.[waitFor]?.whatsapp?.status;
}

function registeredAtFor(reg: StoredRegistration): Date | null {
  const raw = reg.submittedAt || reg.submittedAtIso;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

function bump(stats: AutomationRunStats, field: keyof AutomationRunStats, n = 1) {
  stats[field] += n;
}

export async function runAutomation(
  options: RunAutomationOptions,
): Promise<AutomationRun> {
  const drive = options.drive;
  const driveId = drive.id;
  const kind = options.kind;
  const ctx = driveScheduleContext(drive);
  const automation = drive.automations[kind];

  const runChannels = channelsForAutomationRun(drive.automations, kind, {
    triggeredBy: options.triggeredBy,
    includeEmail: options.includeEmail,
  });
  const force = Boolean(options.force);
  const retryFailed = Boolean(options.retryFailed);
  const resend = Boolean(options.resend);
  const budget = options.timeBudgetMs ?? TIME_BUDGET_MS;
  const started = Date.now();
  const now = () => new Date();
  const selectedIds = [
    ...(options.registrationIds ?? []),
    ...(options.registrationId ? [options.registrationId] : []),
  ];

  const run = await createAutomationRun({
    driveId,
    kind,
    triggeredBy: options.triggeredBy,
    force,
    retryFailed,
  });
  const stats = emptyRunStats();

  const finish = (patch: Partial<AutomationRun>): AutomationRun => ({
    ...run,
    status: "completed",
    stats,
    completedAt: new Date().toISOString(),
    ...patch,
  });

  // A disabled automation must not send, however it was triggered.
  if (!automation?.enabled) {
    await patchAutomationRun(driveId, run.id, {
      status: "completed",
      stats,
      error: "Automation is turned off for this placement drive.",
      completedAt: new Date().toISOString(),
    });
    return finish({ error: "Automation is turned off for this placement drive." });
  }

  try {
    if (selectedIds.length > 0) {
      const regs =
        selectedIds.length === 1
          ? [await getRegistrationById(driveId, selectedIds[0])].filter(
              (r): r is NonNullable<typeof r> => Boolean(r),
            )
          : await getRegistrationsByIds(driveId, selectedIds);
      stats.scanned = regs.length;
      if (regs.length > 0) {
        await processBatch({
          drive,
          ctx,
          kind,
          regs,
          force,
          retryFailed,
          resend,
          stats,
          now: now(),
          runChannels,
        });
      }
      await patchAutomationRun(driveId, run.id, {
        status: "completed",
        stats,
        completedAt: new Date().toISOString(),
        cursor: null,
      });
      return finish({ cursor: null });
    }

    let cursor: string | undefined = options.startCursor;
    let finishedScan = false;
    let batchesSent = 0;

    while (
      shouldStartCronBatch({
        startedAt: started,
        now: Date.now(),
        budgetMs: budget,
        headroomMs:
          options.triggeredBy === "cron"
            ? CRON_BATCH_HEADROOM_MS
            : BATCH_HEADROOM_MS,
        batchesSent,
        maxBatches: options.maxSendBatches,
      })
    ) {
      const page = await listRegistrationsAscending(driveId, {
        limit: PAGE_SIZE,
        cursor,
      });
      stats.scanned += page.registrations.length;

      const eligible = page.registrations.filter((reg) =>
        runChannels.some((channel) => {
          const result = evaluateEligibility({
            ctx,
            kind,
            channel,
            now: now(),
            force,
            retryFailed,
            resend,
            dueAt: dueAtFor(reg, kind),
            registeredAt: registeredAtFor(reg),
            snapshot: channelSnapshot(reg, kind, channel),
            waitForStatus: waitForStatusFor(ctx, reg, kind),
          });
          return (
            result.ok ||
            result.reason === "cutoff" ||
            result.reason === "not_applicable"
          );
        }),
      );

      if (eligible.length > 0) {
        await processBatch({
          drive,
          ctx,
          kind,
          regs: eligible.slice(0, WHATSAPP_BATCH),
          force,
          retryFailed,
          resend,
          stats,
          now: now(),
          runChannels,
        });
        batchesSent += 1;
      }

      const pageHasMoreEligible = eligible.length > WHATSAPP_BATCH;
      if (!pageHasMoreEligible) {
        if (!page.nextCursor) {
          finishedScan = true;
          cursor = undefined;
          break;
        }
        cursor = page.nextCursor;
      }

      if (options.persistCursor) {
        await setCronCursor(driveId, kind, finishedScan ? null : cursor || null);
      }
      await patchAutomationRun(driveId, run.id, { cursor: cursor || null, stats });
    }

    if (options.persistCursor) {
      await setCronCursor(driveId, kind, finishedScan ? null : cursor || null);
    }

    // Always complete this tick so the dashboard does not sit on "sending".
    // Remaining leads are picked up on the next cron via the saved cursor.
    const finalCursor = finishedScan ? null : cursor || null;
    await patchAutomationRun(driveId, run.id, {
      status: "completed",
      stats,
      cursor: finalCursor,
      completedAt: new Date().toISOString(),
    });
    return finish({ cursor: finalCursor });
  } catch (err) {
    const message =
      err instanceof DriveConfigurationError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Automation run failed.";
    await patchAutomationRun(driveId, run.id, {
      status: "completed",
      stats,
      error: message,
      completedAt: new Date().toISOString(),
    });
    return finish({ error: message });
  }
}

async function processBatch(input: {
  drive: PlacementDrive;
  ctx: DriveScheduleContext;
  kind: AutomationKind;
  regs: StoredRegistration[];
  force: boolean;
  retryFailed: boolean;
  resend: boolean;
  stats: AutomationRunStats;
  now: Date;
  runChannels: Channel[];
}): Promise<void> {
  const { drive, ctx, kind, regs, force, retryFailed, resend, stats, now } = input;
  const driveId = drive.id;
  const nowIso = now.toISOString();

  type Claimed = { reg: StoredRegistration; channels: Channel[] };
  const claimed: Claimed[] = [];
  let skippedPermanent = 0;
  let skippedSent = 0;

  await mapPool(regs, WRITE_CONCURRENCY, async (reg) => {
    const channels: Channel[] = [];
    for (const channel of input.runChannels) {
      const elig = evaluateEligibility({
        ctx,
        kind,
        channel,
        now,
        force,
        retryFailed,
        resend,
        dueAt: dueAtFor(reg, kind),
        registeredAt: registeredAtFor(reg),
        snapshot: channelSnapshot(reg, kind, channel),
        waitForStatus: waitForStatusFor(ctx, reg, kind),
      });
      if (!elig.ok) {
        if (elig.reason === "cutoff" || elig.reason === "not_applicable") {
          await setChannelDelivery(driveId, reg.id, kind, channel, {
            ...emptyChannelDelivery("skipped"),
            skippedReason: skipReasonFor(ctx, kind, elig.reason),
          });
          skippedPermanent += 1;
        } else if (elig.reason === "already_sent") {
          skippedSent += 1;
        }
        continue;
      }
      const ok = await claimChannel(driveId, reg.id, kind, channel, nowIso, {
        resend,
        retryFailed,
      });
      if (ok) channels.push(channel);
    }
    if (channels.length) claimed.push({ reg, channels });
  });

  bump(stats, "skipped", skippedPermanent + skippedSent);
  bump(
    stats,
    "claimed",
    claimed.reduce((n, item) => n + item.channels.length, 0),
  );

  const waTargets = claimed.filter((c) => c.channels.includes("whatsapp"));
  const waResults = new Map<string, { ok: boolean; id?: string; error?: string }>();

  if (waTargets.length) {
    let failure: string | null = null;
    if (!hasInfobipConfig()) {
      failure = "Infobip is not configured.";
    }

    if (!failure) {
      try {
        const sendConfig = driveSendConfig(drive);
        const templateName = driveAutomationTemplate(drive, kind);
        const batch = await sendNamedWhatsAppTemplateBatch(
          sendConfig,
          waTargets.map((item) => ({
            to: infobipTo(item.reg.phone),
            firstName: greetingName(item.reg.firstName, item.reg.fullName),
          })),
          templateName,
        );
        waTargets.forEach((item, i) => {
          const result = batch[i]?.result;
          if (result?.ok) {
            waResults.set(item.reg.id, { ok: true, id: result.providerMessageId });
          } else {
            waResults.set(item.reg.id, {
              ok: false,
              error: result && !result.ok ? result.error : "WHATSAPP_SEND_FAILED",
            });
          }
        });
      } catch (err) {
        // A misconfigured drive must fail this batch loudly, not fall back.
        failure =
          err instanceof DriveConfigurationError
            ? err.message
            : err instanceof Error
              ? err.message
              : "WHATSAPP_SEND_FAILED";
      }
    }

    if (failure) {
      for (const item of waTargets) {
        waResults.set(item.reg.id, { ok: false, error: failure });
      }
    }
  }

  let sent = 0;
  let failed = 0;

  await mapPool(waTargets, WRITE_CONCURRENCY, async (item) => {
    const result = waResults.get(item.reg.id);
    if (result?.ok) {
      try {
        await persistChannelDelivery(driveId, item.reg.id, kind, "whatsapp", {
          ...emptyChannelDelivery("sent"),
          sentAt: new Date().toISOString(),
          providerMessageId: result.id || null,
        });
        sent += 1;
      } catch (err) {
        console.error("[runner] Sent WhatsApp but could not save status:", err);
        await extendChannelClaim(driveId, item.reg.id, kind, "whatsapp");
        sent += 1;
      }
    } else {
      await persistChannelDelivery(driveId, item.reg.id, kind, "whatsapp", {
        ...emptyChannelDelivery("failed"),
        error: result?.error || "WHATSAPP_SEND_FAILED",
      }).catch((err) => {
        console.error("[runner] Could not save WhatsApp failure:", err);
      });
      failed += 1;
    }
  });

  const emailTargets = claimed.filter((c) => c.channels.includes("email"));
  await mapPool(emailTargets, EMAIL_CONCURRENCY, async (item) => {
    const result = await sendAutomationEmail(drive, kind, item.reg);
    if (result.ok) {
      try {
        await persistChannelDelivery(driveId, item.reg.id, kind, "email", {
          ...emptyChannelDelivery("sent"),
          sentAt: new Date().toISOString(),
        });
        sent += 1;
      } catch (err) {
        console.error("[runner] Sent email but could not save status:", err);
        await extendChannelClaim(driveId, item.reg.id, kind, "email");
        sent += 1;
      }
    } else {
      await persistChannelDelivery(driveId, item.reg.id, kind, "email", {
        ...emptyChannelDelivery("failed"),
        error: result.error,
      }).catch((err) => {
        console.error("[runner] Could not save email failure:", err);
      });
      failed += 1;
    }
  });

  bump(stats, "sent", sent);
  bump(stats, "failed", failed);
}
