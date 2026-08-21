import { hasInfobipConfig } from "@/lib/whatsapp-otp/config";
import { sendNamedWhatsAppTemplateBatch } from "@/lib/whatsapp-otp/infobip";
import type { StoredRegistration } from "@/lib/firebase/registration-types";
import {
  listRegistrationsAscending,
  getRegistrationById,
  getRegistrationsByIds,
  phoneToDocId,
} from "@/lib/firebase/registrations";
import { channelsForAutomationRun, getAutomation } from "./catalog";
import { evaluateEligibility } from "./schedule";
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

function channelSnapshot(reg: StoredRegistration, kind: AutomationKind, channel: Channel) {
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

function thingsToCarryStatusFor(
  reg: StoredRegistration,
): MessageStatus | null | undefined {
  return reg.messages?.things_to_carry?.whatsapp?.status;
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

function bump(
  stats: AutomationRunStats,
  field: keyof AutomationRunStats,
  n = 1,
) {
  stats[field] += n;
}

export async function runAutomation(
  options: RunAutomationOptions,
): Promise<AutomationRun> {
  const kind = options.kind;
  const runChannels = channelsForAutomationRun(kind, {
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
    kind,
    triggeredBy: options.triggeredBy,
    force,
    retryFailed,
  });
  const stats = emptyRunStats();

  try {
    if (selectedIds.length > 0) {
      const regs =
        selectedIds.length === 1
          ? [await getRegistrationById(selectedIds[0])].filter(
              (r): r is NonNullable<typeof r> => Boolean(r),
            )
          : await getRegistrationsByIds(selectedIds);
      stats.scanned = regs.length;
      if (regs.length > 0) {
        await processBatch(
          kind,
          regs,
          force,
          retryFailed,
          resend,
          stats,
          now(),
          runChannels,
        );
      }
      await patchAutomationRun(run.id, {
        status: "completed",
        stats,
        completedAt: new Date().toISOString(),
        cursor: null,
      });
      return { ...run, status: "completed", stats, completedAt: new Date().toISOString() };
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
      const page = await listRegistrationsAscending({
        limit: PAGE_SIZE,
        cursor,
      });
      stats.scanned += page.registrations.length;

      const eligible = page.registrations.filter((reg) =>
        runChannels.some((channel) => {
          const result = evaluateEligibility({
            kind,
            channel,
            now: now(),
            force,
            retryFailed,
            resend,
            dueAt: dueAtFor(reg, kind),
            registeredAt: registeredAtFor(reg),
            snapshot: channelSnapshot(reg, kind, channel),
            thingsToCarryStatus: thingsToCarryStatusFor(reg),
          });
          return result.ok || result.reason === "cutoff" || result.reason === "not_applicable";
        }),
      );

      if (eligible.length > 0) {
        await processBatch(
          kind,
          eligible.slice(0, WHATSAPP_BATCH),
          force,
          retryFailed,
          resend,
          stats,
          now(),
          runChannels,
        );
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
        await setCronCursor(kind, finishedScan ? null : cursor || null);
      }
      await patchAutomationRun(run.id, { cursor: cursor || null, stats });
    }

    if (options.persistCursor) {
      await setCronCursor(kind, finishedScan ? null : cursor || null);
    }

    // Always complete this tick so the dashboard does not sit on "sending".
    // Remaining leads are picked up on the next cron via the saved cursor.
    await patchAutomationRun(run.id, {
      status: "completed",
      stats,
      cursor: finishedScan ? null : cursor || null,
      completedAt: new Date().toISOString(),
    });
    return {
      ...run,
      status: "completed",
      stats,
      cursor: finishedScan ? null : cursor || null,
      completedAt: new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    await patchAutomationRun(run.id, {
      status: "completed",
      stats,
      error: message,
      completedAt: new Date().toISOString(),
    });
    return {
      ...run,
      status: "completed",
      stats,
      error: message,
      completedAt: new Date().toISOString(),
    };
  }
}

async function processBatch(
  kind: AutomationKind,
  regs: StoredRegistration[],
  force: boolean,
  retryFailed: boolean,
  resend: boolean,
  stats: AutomationRunStats,
  now: Date,
  runChannels: Channel[],
): Promise<void> {
  const def = getAutomation(kind);
  const nowIso = now.toISOString();

  type Claimed = {
    reg: StoredRegistration;
    channels: Channel[];
  };
  const claimed: Claimed[] = [];
  let skippedCutoff = 0;
  let skippedSent = 0;

  await mapPool(regs, WRITE_CONCURRENCY, async (reg) => {
    const channels: Channel[] = [];
    for (const channel of runChannels) {
      const elig = evaluateEligibility({
        kind,
        channel,
        now,
        force,
        retryFailed,
        resend,
        dueAt: dueAtFor(reg, kind),
        registeredAt: registeredAtFor(reg),
        snapshot: channelSnapshot(reg, kind, channel),
        thingsToCarryStatus: thingsToCarryStatusFor(reg),
      });
      if (!elig.ok) {
        if (elig.reason === "cutoff") {
          await setChannelDelivery(reg.id, kind, channel, {
            ...emptyChannelDelivery("skipped"),
            skippedReason: "Past the 8:45 AM IST cutoff on event day.",
          });
          skippedCutoff += 1;
        } else if (elig.reason === "not_applicable") {
          await setChannelDelivery(reg.id, kind, channel, {
            ...emptyChannelDelivery("skipped"),
            skippedReason:
              "Event-day registrations do not receive the day-before reminder.",
          });
          skippedCutoff += 1;
        } else if (elig.reason === "already_sent") {
          skippedSent += 1;
        }
        continue;
      }
      const ok = await claimChannel(reg.id, kind, channel, nowIso, {
        resend,
        retryFailed,
      });
      if (ok) channels.push(channel);
    }
    if (channels.length) {
      claimed.push({ reg, channels });
    }
  });
  bump(stats, "skipped", skippedCutoff + skippedSent);
  bump(
    stats,
    "claimed",
    claimed.reduce((n, item) => n + item.channels.length, 0),
  );

  const waTargets = claimed.filter((c) => c.channels.includes("whatsapp"));
  const waResults = new Map<string, { ok: boolean; id?: string; error?: string }>();

  if (waTargets.length) {
    if (!hasInfobipConfig()) {
      for (const item of waTargets) {
        waResults.set(item.reg.id, { ok: false, error: "Infobip is not configured." });
      }
    } else {
      const batch = await sendNamedWhatsAppTemplateBatch(
        waTargets.map((item) => ({
          to: infobipTo(item.reg.phone),
          firstName: greetingName(item.reg.firstName, item.reg.fullName),
        })),
        def.whatsappTemplateName,
      );
      waTargets.forEach((item, i) => {
        const result = batch[i]?.result;
        if (result?.ok) {
          waResults.set(item.reg.id, {
            ok: true,
            id: result.providerMessageId,
          });
        } else {
          waResults.set(item.reg.id, {
            ok: false,
            error: result && !result.ok ? result.error : "WHATSAPP_SEND_FAILED",
          });
        }
      });
    }
  }

  let sent = 0;
  let failed = 0;

  await mapPool(waTargets, WRITE_CONCURRENCY, async (item) => {
    const result = waResults.get(item.reg.id);
    if (result?.ok) {
      try {
        await persistChannelDelivery(item.reg.id, kind, "whatsapp", {
          ...emptyChannelDelivery("sent"),
          sentAt: new Date().toISOString(),
          providerMessageId: result.id || null,
        });
        sent += 1;
      } catch (err) {
        console.error("[runner] Sent WhatsApp but could not save status:", err);
        await extendChannelClaim(item.reg.id, kind, "whatsapp");
        sent += 1;
      }
    } else {
      await persistChannelDelivery(item.reg.id, kind, "whatsapp", {
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
    const result = await sendAutomationEmail(kind, item.reg);
    if (result.ok) {
      try {
        await persistChannelDelivery(item.reg.id, kind, "email", {
          ...emptyChannelDelivery("sent"),
          sentAt: new Date().toISOString(),
        });
        sent += 1;
      } catch (err) {
        console.error("[runner] Sent email but could not save status:", err);
        await extendChannelClaim(item.reg.id, kind, "email");
        sent += 1;
      }
    } else {
      await persistChannelDelivery(item.reg.id, kind, "email", {
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
